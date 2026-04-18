#!/usr/bin/env python3
"""
Audit and optionally clean MOF linker lookup tables.

Primary uses:
- explain duplicate warnings during manual INSERT/INSERT IGNORE steps
- detect ambiguous aliases (one normalized alias mapping to multiple linker hashes)
- rebuild linker_alias_lookup deterministically from linker_lookup + mof_linkers
- remove obviously invalid alias rows (blank alias/hash or orphaned lookup references)

This script is intentionally conservative: destructive actions only happen when
explicit flags are provided.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

WHITESPACE_RE = re.compile(r"\s+")
DASH_TRANSLATION = str.maketrans(
    {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
    }
)

ALIAS_SOURCE_PRIORITY = {
    "lookup_display_name": 0,
    "lookup_alias": 1,
    "mof_linker_abbr": 2,
    "mof_linker_name": 3,
}


class DBClient:
    def __init__(self, connection: Any):
        self.connection = connection

    def cursor(self):
        return self.connection.cursor()

    def commit(self) -> None:
        self.connection.commit()

    def rollback(self) -> None:
        self.connection.rollback()

    def close(self) -> None:
        self.connection.close()


def normalize_alias(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(DASH_TRANSLATION)
    text = text.strip().lower()
    text = WHITESPACE_RE.sub(" ", text)
    return text


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_csv(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = sorted({k for row in rows for k in row.keys()})
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in fieldnames})


def connect_mysql(args: argparse.Namespace) -> DBClient:
    last_error: Optional[Exception] = None
    try:
        import mysql.connector  # type: ignore
        conn = mysql.connector.connect(
            host=args.mysql_host,
            port=args.mysql_port,
            user=args.mysql_user,
            password=args.mysql_password,
            database=args.mysql_database,
            autocommit=False,
        )
        return DBClient(conn)
    except Exception as exc:
        last_error = exc
    try:
        import pymysql  # type: ignore
        conn = pymysql.connect(
            host=args.mysql_host,
            port=args.mysql_port,
            user=args.mysql_user,
            password=args.mysql_password,
            database=args.mysql_database,
            autocommit=False,
            charset="utf8mb4",
        )
        return DBClient(conn)
    except Exception:
        raise RuntimeError(
            "Could not import a MySQL driver. Install mysql-connector-python or PyMySQL"
        ) from last_error


def fetch_rows(cur: Any) -> List[Tuple[Any, ...]]:
    return list(cur.fetchall())


def table_exists(db: DBClient, table_name: str) -> bool:
    cur = db.cursor()
    try:
        cur.execute("SHOW TABLES LIKE %s", (table_name,))
        return cur.fetchone() is not None
    finally:
        cur.close()


def ensure_alias_table(db: DBClient, linker_lookup_table: str, alias_table: str) -> None:
    ddl = f"""
    CREATE TABLE IF NOT EXISTS `{alias_table}` (
      alias_normalized VARCHAR(255) NOT NULL,
      canonical_smiles_hash VARCHAR(64) NOT NULL,
      alias_raw VARCHAR(255) NOT NULL,
      alias_source ENUM('lookup_display_name','lookup_alias','mof_linker_name','mof_linker_abbr') NOT NULL,
      PRIMARY KEY (alias_normalized, canonical_smiles_hash),
      KEY idx_linker_alias_hash (canonical_smiles_hash),
      KEY idx_linker_alias_source (alias_source),
      CONSTRAINT fk_{alias_table}_lookup
        FOREIGN KEY (canonical_smiles_hash)
        REFERENCES `{linker_lookup_table}` (canonical_smiles_hash)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    cur = db.cursor()
    try:
        cur.execute(ddl)
    finally:
        cur.close()


def load_linker_lookup_rows(db: DBClient, table_name: str) -> List[Dict[str, Any]]:
    cur = db.cursor()
    try:
        cur.execute(
            f"SELECT canonical_smiles_hash, canonical_smiles, display_name, aliases_json FROM `{table_name}`"
        )
        rows = fetch_rows(cur)
        names = [d[0] for d in cur.description]
        return [dict(zip(names, row)) for row in rows]
    finally:
        cur.close()


def load_mof_linkers_rows(db: DBClient, table_name: str) -> List[Dict[str, Any]]:
    cur = db.cursor()
    try:
        cur.execute(
            f"SELECT mof_id, linker_position, linker_name, linker_abbr, canonical_smiles_hash, resolution_status FROM `{table_name}`"
        )
        rows = fetch_rows(cur)
        names = [d[0] for d in cur.description]
        return [dict(zip(names, row)) for row in rows]
    finally:
        cur.close()


def build_alias_rows(
    linker_lookup_rows: Sequence[Dict[str, Any]],
    mof_linkers_rows: Sequence[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    alias_rows_by_key: Dict[Tuple[str, str], Dict[str, Any]] = {}
    collapsed_duplicates: List[Dict[str, Any]] = []
    ambiguous_aliases: Dict[str, set] = {}

    def register(alias_raw: Any, canonical_hash: Any, alias_source: str) -> None:
        if not alias_raw or not canonical_hash:
            return
        alias_raw = str(alias_raw).strip()
        if not alias_raw:
            return
        canonical_hash = str(canonical_hash)
        alias_normalized = normalize_alias(alias_raw)
        if not alias_normalized:
            return
        key = (alias_normalized, canonical_hash)
        row = {
            "alias_normalized": alias_normalized,
            "canonical_smiles_hash": canonical_hash,
            "alias_raw": alias_raw,
            "alias_source": alias_source,
        }
        ambiguous_aliases.setdefault(alias_normalized, set()).add(canonical_hash)
        existing = alias_rows_by_key.get(key)
        if existing is None:
            alias_rows_by_key[key] = row
            return
        old_pri = ALIAS_SOURCE_PRIORITY.get(existing["alias_source"], 999)
        new_pri = ALIAS_SOURCE_PRIORITY.get(alias_source, 999)
        if new_pri < old_pri or (new_pri == old_pri and len(alias_raw) < len(existing["alias_raw"])):
            collapsed_duplicates.append(
                {
                    "alias_normalized": alias_normalized,
                    "canonical_smiles_hash": canonical_hash,
                    "kept_alias_raw": alias_raw,
                    "kept_alias_source": alias_source,
                    "discarded_alias_raw": existing["alias_raw"],
                    "discarded_alias_source": existing["alias_source"],
                    "reason": "priority_replaced",
                }
            )
            alias_rows_by_key[key] = row
        else:
            collapsed_duplicates.append(
                {
                    "alias_normalized": alias_normalized,
                    "canonical_smiles_hash": canonical_hash,
                    "kept_alias_raw": existing["alias_raw"],
                    "kept_alias_source": existing["alias_source"],
                    "discarded_alias_raw": alias_raw,
                    "discarded_alias_source": alias_source,
                    "reason": "duplicate_ignored",
                }
            )

    for row in linker_lookup_rows:
        canonical_hash = row.get("canonical_smiles_hash")
        register(row.get("display_name"), canonical_hash, "lookup_display_name")
        aliases_json = row.get("aliases_json")
        aliases: List[str] = []
        if aliases_json:
            if isinstance(aliases_json, str):
                try:
                    parsed = json.loads(aliases_json)
                except Exception:
                    parsed = []
            else:
                parsed = aliases_json
            if isinstance(parsed, list):
                aliases = [str(v) for v in parsed if v is not None]
        for alias in aliases:
            register(alias, canonical_hash, "lookup_alias")

    for row in mof_linkers_rows:
        if str(row.get("resolution_status") or "") != "resolved":
            continue
        canonical_hash = row.get("canonical_smiles_hash")
        register(row.get("linker_name"), canonical_hash, "mof_linker_name")
        register(row.get("linker_abbr"), canonical_hash, "mof_linker_abbr")

    ambiguous_rows = []
    for alias_normalized, hashes in sorted(ambiguous_aliases.items()):
        if len(hashes) > 1:
            ambiguous_rows.append(
                {
                    "alias_normalized": alias_normalized,
                    "canonical_hash_count": len(hashes),
                    "canonical_smiles_hashes": json_dumps(sorted(hashes)),
                }
            )

    final_rows = sorted(
        alias_rows_by_key.values(),
        key=lambda row: (row["alias_normalized"], row["canonical_smiles_hash"]),
    )
    return final_rows, collapsed_duplicates, ambiguous_rows


def audit_existing_alias_table(db: DBClient, alias_table: str, linker_lookup_table: str) -> Dict[str, List[Dict[str, Any]]]:
    results: Dict[str, List[Dict[str, Any]]] = {
        "orphan_rows": [],
        "blank_alias_rows": [],
        "ambiguous_alias_rows": [],
    }
    if not table_exists(db, alias_table):
        return results

    cur = db.cursor()
    try:
        cur.execute(
            f"""
            SELECT la.alias_normalized, la.canonical_smiles_hash, la.alias_raw, la.alias_source
            FROM `{alias_table}` la
            LEFT JOIN `{linker_lookup_table}` ll
              ON ll.canonical_smiles_hash = la.canonical_smiles_hash
            WHERE ll.canonical_smiles_hash IS NULL
            """
        )
        results["orphan_rows"] = [
            dict(zip([d[0] for d in cur.description], row)) for row in fetch_rows(cur)
        ]

        cur.execute(
            f"""
            SELECT alias_normalized, canonical_smiles_hash, alias_raw, alias_source
            FROM `{alias_table}`
            WHERE alias_normalized IS NULL OR TRIM(alias_normalized) = ''
            """
        )
        results["blank_alias_rows"] = [
            dict(zip([d[0] for d in cur.description], row)) for row in fetch_rows(cur)
        ]

        cur.execute(
            f"""
            SELECT alias_normalized,
                   COUNT(DISTINCT canonical_smiles_hash) AS canonical_hash_count,
                   GROUP_CONCAT(DISTINCT canonical_smiles_hash ORDER BY canonical_smiles_hash SEPARATOR ',') AS canonical_smiles_hashes
            FROM `{alias_table}`
            GROUP BY alias_normalized
            HAVING COUNT(DISTINCT canonical_smiles_hash) > 1
            ORDER BY canonical_hash_count DESC, alias_normalized ASC
            """
        )
        results["ambiguous_alias_rows"] = [
            dict(zip([d[0] for d in cur.description], row)) for row in fetch_rows(cur)
        ]
    finally:
        cur.close()
    return results


def rebuild_alias_table(db: DBClient, alias_table: str, rows: Sequence[Dict[str, Any]]) -> int:
    cur = db.cursor()
    try:
        cur.execute(f"TRUNCATE TABLE `{alias_table}`")
        if rows:
            cur.executemany(
                f"""
                INSERT INTO `{alias_table}` (
                  alias_normalized,
                  canonical_smiles_hash,
                  alias_raw,
                  alias_source
                ) VALUES (%s, %s, %s, %s)
                """,
                [
                    (
                        row["alias_normalized"],
                        row["canonical_smiles_hash"],
                        row["alias_raw"],
                        row["alias_source"],
                    )
                    for row in rows
                ],
            )
        return len(rows)
    finally:
        cur.close()


def prune_invalid_alias_rows(db: DBClient, alias_table: str, linker_lookup_table: str) -> int:
    cur = db.cursor()
    try:
        cur.execute(
            f"""
            DELETE la
            FROM `{alias_table}` la
            LEFT JOIN `{linker_lookup_table}` ll
              ON ll.canonical_smiles_hash = la.canonical_smiles_hash
            WHERE ll.canonical_smiles_hash IS NULL
               OR la.alias_normalized IS NULL
               OR TRIM(la.alias_normalized) = ''
            """
        )
        return int(cur.rowcount or 0)
    finally:
        cur.close()


def count_rows(db: DBClient, table_name: str) -> int:
    cur = db.cursor()
    try:
        cur.execute(f"SELECT COUNT(*) FROM `{table_name}`")
        row = cur.fetchone()
        return int(row[0]) if row else 0
    finally:
        cur.close()


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mysql-host", default=os.environ.get("MYSQL_HOST", "127.0.0.1"))
    parser.add_argument("--mysql-port", type=int, default=int(os.environ.get("MYSQL_PORT", "3306")))
    parser.add_argument("--mysql-user", default=os.environ.get("USER"))
    parser.add_argument("--mysql-password", default=os.environ.get("MYSQL_PASSWORD"))
    parser.add_argument("--mysql-database", default=os.environ.get("MYSQL_DATABASE", "mof_app"))

    parser.add_argument("--mof-linkers-table", default="mof_linkers")
    parser.add_argument("--linker-lookup-table", default="linker_lookup")
    parser.add_argument("--linker-alias-lookup-table", default="linker_alias_lookup")

    parser.add_argument("--create-alias-table", action="store_true")
    parser.add_argument("--rebuild-alias-table", action="store_true")
    parser.add_argument("--prune-invalid-alias-rows", action="store_true")
    parser.add_argument("--out-dir", type=Path, help="Optional directory for audit CSV/JSON outputs")

    args = parser.parse_args(argv)
    if not args.mysql_password:
        args.mysql_password = getpass.getpass(f"Enter MySQL password for {args.mysql_user}: ")
    return args


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    db = connect_mysql(args)

    try:
        if args.create_alias_table:
            ensure_alias_table(db, args.linker_lookup_table, args.linker_alias_lookup_table)

        linker_lookup_rows = load_linker_lookup_rows(db, args.linker_lookup_table)
        mof_linkers_rows = load_mof_linkers_rows(db, args.mof_linkers_table)
        computed_alias_rows, collapsed_duplicates, computed_ambiguous = build_alias_rows(
            linker_lookup_rows, mof_linkers_rows
        )
        existing_alias_audit = audit_existing_alias_table(db, args.linker_alias_lookup_table, args.linker_lookup_table)

        pruned_count = 0
        rebuilt_count = 0

        if args.prune_invalid_alias_rows:
            pruned_count = prune_invalid_alias_rows(db, args.linker_alias_lookup_table, args.linker_lookup_table)

        if args.rebuild_alias_table:
            ensure_alias_table(db, args.linker_lookup_table, args.linker_alias_lookup_table)
            rebuilt_count = rebuild_alias_table(db, args.linker_alias_lookup_table, computed_alias_rows)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        counts = {
            "linker_lookup": count_rows(db, args.linker_lookup_table) if table_exists(db, args.linker_lookup_table) else 0,
            "mof_linkers": count_rows(db, args.mof_linkers_table) if table_exists(db, args.mof_linkers_table) else 0,
            "linker_alias_lookup": count_rows(db, args.linker_alias_lookup_table) if table_exists(db, args.linker_alias_lookup_table) else 0,
        }
        db.close()

    report = {
        "table_counts": counts,
        "computed_alias_rows": len(computed_alias_rows),
        "collapsed_duplicate_source_rows": len(collapsed_duplicates),
        "computed_ambiguous_aliases": len(computed_ambiguous),
        "existing_orphan_alias_rows": len(existing_alias_audit["orphan_rows"]),
        "existing_blank_alias_rows": len(existing_alias_audit["blank_alias_rows"]),
        "existing_ambiguous_alias_rows": len(existing_alias_audit["ambiguous_alias_rows"]),
        "pruned_invalid_alias_rows": pruned_count,
        "rebuilt_alias_rows": rebuilt_count,
    }

    print(json.dumps(report, indent=2))

    if args.out_dir:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        (args.out_dir / "summary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        write_csv(args.out_dir / "computed_alias_rows.csv", computed_alias_rows)
        write_csv(args.out_dir / "collapsed_duplicate_source_rows.csv", collapsed_duplicates)
        write_csv(args.out_dir / "computed_ambiguous_aliases.csv", computed_ambiguous)
        write_csv(args.out_dir / "existing_orphan_alias_rows.csv", existing_alias_audit["orphan_rows"])
        write_csv(args.out_dir / "existing_blank_alias_rows.csv", existing_alias_audit["blank_alias_rows"])
        write_csv(args.out_dir / "existing_ambiguous_alias_rows.csv", existing_alias_audit["ambiguous_alias_rows"])
        print(f"Audit artifacts written to: {args.out_dir}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

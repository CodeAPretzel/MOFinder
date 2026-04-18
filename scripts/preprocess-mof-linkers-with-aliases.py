#!/usr/bin/env python3
"""
Preprocess MOF linker data and load it into MySQL, including a searchable
linker_alias_lookup table for fast linker abbreviation / alias resolution.

This is a drop-in successor to preprocess-mof-linkers.py.

Supports three source modes:
  1) source=csv   - use raw preprocessing CSV as linker source
  2) source=mysql - backfill directly from existing mof_entry rows
  3) source=json  - compatibility/debugging only
"""

from __future__ import annotations

import argparse
import csv
import getpass
import hashlib
import json
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from rdkit import Chem # type: ignore
from rdkit.Chem.MolStandardize import rdMolStandardize # type: ignore

LINKER_FIELD_RE = re.compile(r"^linker_(\d+)$", re.IGNORECASE)
LINKER_ABBR_FIELD_RE = re.compile(r"^linker_(\d+)_abbr$", re.IGNORECASE)
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

PLACEHOLDER_STRINGS = {
	"",
	"na",
	"n/a",
	"none",
	"null",
	"nan",
	"not available",
	"unknown",
}

ALIAS_SOURCE_PRIORITY = {
	"lookup_display_name": 0,
	"lookup_alias": 1,
	"mof_linker_abbr": 2,
	"mof_linker_name": 3,
}


class DBClient:
	def __init__(self, connection: Any, flavor: str):
		self.connection = connection
		self.flavor = flavor

	def cursor(self):
		return self.connection.cursor()

	def commit(self) -> None:
		self.connection.commit()

	def rollback(self) -> None:
		self.connection.rollback()

	def close(self) -> None:
		self.connection.close()


def load_json(path: Path) -> Any:
	with path.open("r", encoding="utf-8") as f:
		return json.load(f)


def load_records_from_json(path: Path) -> List[Dict[str, Any]]:
	payload = load_json(path)
	if isinstance(payload, list):
		return [row for row in payload if isinstance(row, dict)]
	if isinstance(payload, dict) and isinstance(payload.get("data"), list):
		return [row for row in payload["data"] if isinstance(row, dict)]
	raise ValueError("Unsupported MOF JSON shape. Expected a list or an object with a 'data' list.")


def load_records_from_csv(path: Path) -> List[Dict[str, Any]]:
	with path.open("r", encoding="utf-8-sig", newline="") as f:
		reader = csv.DictReader(f)
		return [dict(row) for row in reader]


def normalize_alias(value: Any) -> str:
	if value is None:
		return ""
	text = str(value)
	text = unicodedata.normalize("NFKC", text)
	text = text.translate(DASH_TRANSLATION)
	text = text.strip().lower()
	text = WHITESPACE_RE.sub(" ", text)
	return text


def clean_scalar(value: Any) -> Optional[str]:
	if value is None:
		return None
	text = str(value).strip()
	if not text:
		return None
	if text.lower() in PLACEHOLDER_STRINGS:
		return None
	return text


def clean_linker_value(value: Any) -> Optional[str]:
	text = clean_scalar(value)
	if text is None:
		return None
	if text == "0":
		return None
	return text


def canonicalize_smiles(smiles: Any) -> str:
	if smiles is None:
		return ""

	text = str(smiles).strip()
	text = WHITESPACE_RE.sub("", text)
	if not text:
		return ""

	mol = Chem.MolFromSmiles(text)
	if mol is None:
		return ""

	mol = rdMolStandardize.Cleanup(mol)

	return Chem.MolToSmiles(
		mol,
		canonical=True,
		isomericSmiles=True,
		kekuleSmiles=False,
	)


def smiles_hash(smiles: str) -> str:
	return hashlib.sha256(smiles.encode("utf-8")).hexdigest()


def json_dumps(value: Any) -> str:
	return json.dumps(value, ensure_ascii=False)


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
		return DBClient(conn, "mysql-connector")
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
		return DBClient(conn, "pymysql")
	except Exception as exc:
		if last_error is None:
			last_error = exc
		raise RuntimeError(
			"Could not import a MySQL driver. Install one of: mysql-connector-python or PyMySQL"
		) from last_error


def fetch_all(cur: Any) -> List[Tuple[Any, ...]]:
	return list(cur.fetchall())


def column_names(cur: Any) -> List[str]:
	return [desc[0] for desc in cur.description]


def discover_source_columns(db: DBClient, table_name: str) -> List[str]:
	cur = db.cursor()
	try:
		cur.execute(f"SHOW COLUMNS FROM `{table_name}`")
		rows = fetch_all(cur)
		return [row[0] for row in rows]
	finally:
		cur.close()


def load_records_from_mysql(db: DBClient, table_name: str, where: Optional[str] = None) -> List[Dict[str, Any]]:
	available_columns = discover_source_columns(db, table_name)
	wanted = ["id", "doi", "mof_name"]
	wanted.extend(
		col
		for col in available_columns
		if LINKER_FIELD_RE.match(col) or LINKER_ABBR_FIELD_RE.match(col)
	)
	if not any(LINKER_FIELD_RE.match(col) for col in available_columns):
		raise ValueError(f"No linker_N columns found in source table {table_name!r}")

	select_cols = [col for col in wanted if col in available_columns]
	sql = "SELECT " + ", ".join(f"`{c}`" for c in select_cols) + f" FROM `{table_name}`"
	if where:
		sql += f" WHERE {where}"

	cur = db.cursor()
	try:
		cur.execute(sql)
		rows = fetch_all(cur)
		names = column_names(cur)
		return [dict(zip(names, row)) for row in rows]
	finally:
		cur.close()


def build_alias_maps(
	name2smiles_raw: Dict[str, str],
	smiles2name_raw: Dict[str, Sequence[str]],
) -> Tuple[Dict[str, str], Dict[str, List[str]]]:
	alias_to_smiles: Dict[str, str] = {}
	smiles_to_aliases: Dict[str, List[str]] = defaultdict(list)

	for alias, smiles in name2smiles_raw.items():
		norm_alias = normalize_alias(alias)
		norm_smiles = canonicalize_smiles(smiles)
		if not norm_alias or not norm_smiles:
			continue
		existing = alias_to_smiles.get(norm_alias)
		if existing and existing != norm_smiles:
			continue
		alias_to_smiles[norm_alias] = norm_smiles
		smiles_to_aliases[norm_smiles].append(str(alias).strip())

	for smiles, aliases in smiles2name_raw.items():
		norm_smiles = canonicalize_smiles(smiles)
		if not norm_smiles:
			continue
		for alias in aliases or []:
			norm_alias = normalize_alias(alias)
			if not norm_alias:
				continue
			existing = alias_to_smiles.get(norm_alias)
			if existing is None:
				alias_to_smiles[norm_alias] = norm_smiles
			smiles_to_aliases[norm_smiles].append(str(alias).strip())

	for canonical_smiles in list(smiles_to_aliases.keys()):
		alias_to_smiles.setdefault(normalize_alias(canonical_smiles), canonical_smiles)

	deduped: Dict[str, List[str]] = {}
	for canonical_smiles, aliases in smiles_to_aliases.items():
		seen = set()
		uniq: List[str] = []
		for alias in aliases:
			clean = str(alias).strip()
			if not clean:
				continue
			key = normalize_alias(clean)
			if key in seen:
				continue
			seen.add(key)
			uniq.append(clean)
		deduped[canonical_smiles] = uniq

	return alias_to_smiles, deduped


def pick_display_name(
	linker_name: Optional[str],
	linker_abbr: Optional[str],
	aliases: Sequence[str],
) -> Optional[str]:
	normalized_aliases = {normalize_alias(a) for a in aliases}
	for value in (linker_name, linker_abbr):
		if value and normalize_alias(value) in normalized_aliases:
			return str(value).strip()
	for alias in aliases:
		if len(alias) >= 6 or " " in alias or "," in alias or "-" in alias:
			return alias
	return aliases[0] if aliases else (linker_name or linker_abbr)


def resolve_linker(
	linker_name: Optional[str],
	linker_abbr: Optional[str],
	alias_to_smiles: Dict[str, str],
	smiles_to_aliases: Dict[str, List[str]],
) -> Dict[str, Any]:
	candidates: List[Tuple[str, str]] = []
	for source, raw_value in (("name", linker_name), ("abbr", linker_abbr)):
		norm = normalize_alias(raw_value)
		if not norm:
			continue
		smiles = alias_to_smiles.get(norm)
		if smiles:
			candidates.append((source, smiles))

	unique_smiles = sorted({smiles for _, smiles in candidates})
	result: Dict[str, Any] = {
		"canonical_smiles": None,
		"canonical_smiles_hash": None,
		"display_name": None,
		"aliases_json": json_dumps([]),
		"matched_by": None,
		"resolution_status": None,
		"candidate_smiles_json": json_dumps(unique_smiles),
	}

	if not candidates:
		result["resolution_status"] = "unresolved"
		return result

	if len(unique_smiles) > 1:
		result["resolution_status"] = "ambiguous"
		result["matched_by"] = ",".join(sorted({source for source, _ in candidates}))
		return result

	canonical_smiles = unique_smiles[0]
	aliases = smiles_to_aliases.get(canonical_smiles, [])
	result.update(
		{
			"canonical_smiles": canonical_smiles,
			"canonical_smiles_hash": smiles_hash(canonical_smiles),
			"display_name": pick_display_name(linker_name, linker_abbr, aliases),
			"aliases_json": json_dumps(aliases),
			"matched_by": ",".join(sorted({source for source, _ in candidates})),
			"resolution_status": "resolved",
		}
	)
	return result


def extract_linker_slots(record: Dict[str, Any]) -> List[Tuple[int, Optional[str], Optional[str]]]:
	slots: List[Tuple[int, Optional[str], Optional[str]]] = []
	positions = set()
	for key in record.keys():
		m_name = LINKER_FIELD_RE.match(key)
		m_abbr = LINKER_ABBR_FIELD_RE.match(key)
		if m_name:
			positions.add(int(m_name.group(1)))
		if m_abbr:
			positions.add(int(m_abbr.group(1)))

	for position in sorted(positions):
		linker_name = clean_linker_value(record.get(f"linker_{position}"))
		linker_abbr = clean_linker_value(record.get(f"linker_{position}_abbr"))
		if linker_name or linker_abbr:
			slots.append((position, linker_name, linker_abbr))
	return slots


def build_mof_id_lookup(db: DBClient, table_name: str) -> Dict[Tuple[str, str], int]:
	available_columns = discover_source_columns(db, table_name)
	select_cols = [col for col in ["id", "doi", "mof_name"] if col in available_columns]
	if "id" not in select_cols:
		raise ValueError(f"Lookup table {table_name!r} must contain an 'id' column")

	cur = db.cursor()
	try:
		cur.execute("SELECT " + ", ".join(f"`{c}`" for c in select_cols) + f" FROM `{table_name}`")
		rows = fetch_all(cur)
		names = column_names(cur)
	finally:
		cur.close()

	lookup: Dict[Tuple[str, str], int] = {}
	for row in rows:
		record = dict(zip(names, row))
		mof_id = int(record["id"])
		doi_key = normalize_alias(record.get("doi"))
		name_key = normalize_alias(record.get("mof_name"))
		if doi_key:
			lookup[("doi", doi_key)] = mof_id
		if doi_key and name_key:
			lookup[("doi_name", f"{doi_key}||{name_key}")] = mof_id
		if name_key:
			lookup[("name", name_key)] = mof_id
	return lookup


def resolve_record_mof_id(record: Dict[str, Any], lookup: Dict[Tuple[str, str], int]) -> Optional[int]:
	existing_id = record.get("id")
	if existing_id not in (None, "", 0, "0"):
		try:
			return int(existing_id)
		except Exception:
			pass

	doi_key = normalize_alias(record.get("doi"))
	name_key = normalize_alias(record.get("mof_name"))
	if doi_key and name_key:
		match = lookup.get(("doi_name", f"{doi_key}||{name_key}"))
		if match is not None:
			return match
	if doi_key:
		match = lookup.get(("doi", doi_key))
		if match is not None:
			return match
	if name_key:
		match = lookup.get(("name", name_key))
		if match is not None:
			return match
	return None


def attach_mof_ids(
	records: Sequence[Dict[str, Any]],
	lookup: Dict[Tuple[str, str], int],
	skip_missing_mof_id: bool,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
	resolved_records: List[Dict[str, Any]] = []
	skipped_records: List[Dict[str, Any]] = []

	for record in records:
		new_record = dict(record)
		mof_id = resolve_record_mof_id(new_record, lookup)
		if mof_id is None:
			skipped_records.append(new_record)
			if skip_missing_mof_id:
				continue
			doi = clean_scalar(new_record.get("doi"))
			mof_name = clean_scalar(new_record.get("mof_name"))
			raise ValueError(
				f"Could not resolve mof_entry.id for record with doi={doi!r}, mof_name={mof_name!r}. "
				"Use --skip-missing-mof-id to skip unmatched rows."
			)
		new_record["id"] = mof_id
		resolved_records.append(new_record)

	return resolved_records, skipped_records


def build_outputs(
	records: Sequence[Dict[str, Any]],
	alias_to_smiles: Dict[str, str],
	smiles_to_aliases: Dict[str, List[str]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
	mof_linkers_rows: List[Dict[str, Any]] = []
	unresolved_rows: List[Dict[str, Any]] = []
	linker_lookup_by_hash: Dict[str, Dict[str, Any]] = {}
	alias_rows_by_key: Dict[Tuple[str, str], Dict[str, Any]] = {}
	alias_collisions: List[Dict[str, Any]] = []

	def consider_alias(alias_raw: Optional[str], canonical_hash: Optional[str], source: str) -> None:
		if not alias_raw or not canonical_hash:
			return
		alias_normalized = normalize_alias(alias_raw)
		if not alias_normalized:
			return
		key = (alias_normalized, canonical_hash)
		candidate = {
			"alias_normalized": alias_normalized,
			"canonical_smiles_hash": canonical_hash,
			"alias_raw": str(alias_raw).strip(),
			"alias_source": source,
		}
		existing = alias_rows_by_key.get(key)
		if existing is None:
			alias_rows_by_key[key] = candidate
			return
		old_pri = ALIAS_SOURCE_PRIORITY.get(existing["alias_source"], 999)
		new_pri = ALIAS_SOURCE_PRIORITY.get(source, 999)
		if new_pri < old_pri or (
			new_pri == old_pri and len(candidate["alias_raw"]) < len(existing["alias_raw"])
		):
			alias_collisions.append(
				{
					"alias_normalized": alias_normalized,
					"canonical_smiles_hash": canonical_hash,
					"kept_alias_raw": candidate["alias_raw"],
					"kept_alias_source": source,
					"discarded_alias_raw": existing["alias_raw"],
					"discarded_alias_source": existing["alias_source"],
					"reason": "priority_replaced",
				}
			)
			alias_rows_by_key[key] = candidate
		else:
			alias_collisions.append(
				{
					"alias_normalized": alias_normalized,
					"canonical_smiles_hash": canonical_hash,
					"kept_alias_raw": existing["alias_raw"],
					"kept_alias_source": existing["alias_source"],
					"discarded_alias_raw": candidate["alias_raw"],
					"discarded_alias_source": source,
					"reason": "duplicate_ignored",
				}
			)

	for record in records:
		mof_id = record.get("id")
		if mof_id in (None, "", 0, "0"):
			raise ValueError("Encountered record without mof_id/id after source resolution")

		for position, linker_name, linker_abbr in extract_linker_slots(record):
			resolved = resolve_linker(linker_name, linker_abbr, alias_to_smiles, smiles_to_aliases)
			row = {
				"mof_id": int(mof_id),
				"linker_position": position,
				"linker_name": linker_name,
				"linker_abbr": linker_abbr,
				**resolved,
			}
			mof_linkers_rows.append(row)

			if resolved["resolution_status"] != "resolved":
				unresolved_rows.append(row)
				continue

			canonical_hash = resolved["canonical_smiles_hash"]
			lookup_aliases = json.loads(resolved["aliases_json"])

			linker_lookup_by_hash[canonical_hash] = {
				"canonical_smiles_hash": canonical_hash,
				"canonical_smiles": resolved["canonical_smiles"],
				"display_name": resolved["display_name"],
				"aliases_json": resolved["aliases_json"],
			}

			consider_alias(resolved["display_name"], canonical_hash, "lookup_display_name")
			for alias in lookup_aliases:
				consider_alias(alias, canonical_hash, "lookup_alias")
			consider_alias(linker_name, canonical_hash, "mof_linker_name")
			consider_alias(linker_abbr, canonical_hash, "mof_linker_abbr")

	linker_lookup_rows = sorted(
		linker_lookup_by_hash.values(),
		key=lambda row: ((row["display_name"] or ""), row["canonical_smiles_hash"]),
	)
	alias_rows = sorted(
		alias_rows_by_key.values(),
		key=lambda row: (row["alias_normalized"], row["canonical_smiles_hash"]),
	)
	return mof_linkers_rows, linker_lookup_rows, alias_rows, unresolved_rows, alias_collisions


def create_tables(
	db: DBClient,
	mof_linkers_table: str,
	linker_lookup_table: str,
	linker_alias_lookup_table: str,
) -> None:
	ddl_lookup = f"""
	CREATE TABLE IF NOT EXISTS `{linker_lookup_table}` (
	  canonical_smiles_hash VARCHAR(64) PRIMARY KEY,
	  canonical_smiles TEXT NOT NULL,
	  display_name VARCHAR(255) NULL,
	  aliases_json JSON NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	"""

	ddl_mof_linkers = f"""
	CREATE TABLE IF NOT EXISTS `{mof_linkers_table}` (
	  mof_id BIGINT UNSIGNED NOT NULL,
	  linker_position TINYINT UNSIGNED NOT NULL,
	  linker_name VARCHAR(512) NULL,
	  linker_abbr VARCHAR(128) NULL,
	  canonical_smiles TEXT NULL,
	  canonical_smiles_hash VARCHAR(64) NULL,
	  display_name VARCHAR(255) NULL,
	  aliases_json JSON NULL,
	  matched_by VARCHAR(32) NULL,
	  resolution_status VARCHAR(32) NOT NULL,
	  candidate_smiles_json JSON NULL,
	  PRIMARY KEY (mof_id, linker_position),
	  KEY idx_canonical_smiles_hash (canonical_smiles_hash),
	  CONSTRAINT fk_{mof_linkers_table}_lookup
		FOREIGN KEY (canonical_smiles_hash)
		REFERENCES `{linker_lookup_table}` (canonical_smiles_hash)
		ON DELETE SET NULL
		ON UPDATE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	"""

	ddl_alias_lookup = f"""
	CREATE TABLE IF NOT EXISTS `{linker_alias_lookup_table}` (
	  alias_normalized VARCHAR(255) NOT NULL,
	  canonical_smiles_hash VARCHAR(64) NOT NULL,
	  alias_raw VARCHAR(255) NOT NULL,
	  alias_source ENUM('lookup_display_name','lookup_alias','mof_linker_name','mof_linker_abbr') NOT NULL,
	  PRIMARY KEY (alias_normalized, canonical_smiles_hash),
	  KEY idx_linker_alias_hash (canonical_smiles_hash),
	  KEY idx_linker_alias_source (alias_source),
	  CONSTRAINT fk_{linker_alias_lookup_table}_lookup
		FOREIGN KEY (canonical_smiles_hash)
		REFERENCES `{linker_lookup_table}` (canonical_smiles_hash)
		ON DELETE CASCADE
		ON UPDATE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	"""

	cur = db.cursor()
	try:
		cur.execute(ddl_lookup)
		cur.execute(ddl_mof_linkers)
		cur.execute(ddl_alias_lookup)
	finally:
		cur.close()


def clear_tables(
	db: DBClient,
	mof_linkers_table: str,
	linker_lookup_table: str,
	linker_alias_lookup_table: str,
) -> None:
	cur = db.cursor()
	try:
		cur.execute("SET FOREIGN_KEY_CHECKS = 0")
		cur.execute(f"TRUNCATE TABLE `{linker_alias_lookup_table}`")
		cur.execute(f"TRUNCATE TABLE `{mof_linkers_table}`")
		cur.execute(f"TRUNCATE TABLE `{linker_lookup_table}`")
		cur.execute("SET FOREIGN_KEY_CHECKS = 1")
	finally:
		cur.close()


def write_csv(path: Path, rows: Sequence[Dict[str, Any]], fieldnames: Sequence[str]) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	with path.open("w", encoding="utf-8", newline="") as f:
		writer = csv.DictWriter(f, fieldnames=fieldnames)
		writer.writeheader()
		for row in rows:
			writer.writerow({field: row.get(field) for field in fieldnames})


def insert_linker_lookup_rows(db: DBClient, table_name: str, rows: Sequence[Dict[str, Any]]) -> None:
	if not rows:
		return
	sql = f"""
	INSERT INTO `{table_name}` (
	  canonical_smiles_hash,
	  canonical_smiles,
	  display_name,
	  aliases_json
	) VALUES (%s, %s, %s, %s)
	ON DUPLICATE KEY UPDATE
	  canonical_smiles = VALUES(canonical_smiles),
	  display_name = VALUES(display_name),
	  aliases_json = VALUES(aliases_json)
	"""
	payload = [
		(
			row["canonical_smiles_hash"],
			row["canonical_smiles"],
			row.get("display_name"),
			row.get("aliases_json"),
		)
		for row in rows
	]
	cur = db.cursor()
	try:
		cur.executemany(sql, payload)
	finally:
		cur.close()


def insert_mof_linker_rows(db: DBClient, table_name: str, rows: Sequence[Dict[str, Any]]) -> None:
	if not rows:
		return
	sql = f"""
	INSERT INTO `{table_name}` (
	  mof_id,
	  linker_position,
	  linker_name,
	  linker_abbr,
	  canonical_smiles,
	  canonical_smiles_hash,
	  display_name,
	  aliases_json,
	  matched_by,
	  resolution_status,
	  candidate_smiles_json
	) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
	ON DUPLICATE KEY UPDATE
	  linker_name = VALUES(linker_name),
	  linker_abbr = VALUES(linker_abbr),
	  canonical_smiles = VALUES(canonical_smiles),
	  canonical_smiles_hash = VALUES(canonical_smiles_hash),
	  display_name = VALUES(display_name),
	  aliases_json = VALUES(aliases_json),
	  matched_by = VALUES(matched_by),
	  resolution_status = VALUES(resolution_status),
	  candidate_smiles_json = VALUES(candidate_smiles_json)
	"""
	payload = [
		(
			row.get("mof_id"),
			row.get("linker_position"),
			row.get("linker_name"),
			row.get("linker_abbr"),
			row.get("canonical_smiles"),
			row.get("canonical_smiles_hash"),
			row.get("display_name"),
			row.get("aliases_json"),
			row.get("matched_by"),
			row.get("resolution_status"),
			row.get("candidate_smiles_json"),
		)
		for row in rows
	]
	cur = db.cursor()
	try:
		cur.executemany(sql, payload)
	finally:
		cur.close()


def insert_alias_rows(db: DBClient, table_name: str, rows: Sequence[Dict[str, Any]]) -> None:
	if not rows:
		return
	sql = f"""
	INSERT INTO `{table_name}` (
	  alias_normalized,
	  canonical_smiles_hash,
	  alias_raw,
	  alias_source
	) VALUES (%s, %s, %s, %s)
	ON DUPLICATE KEY UPDATE
	  alias_raw = VALUES(alias_raw),
	  alias_source = VALUES(alias_source)
	"""
	payload = [
		(
			row["alias_normalized"],
			row["canonical_smiles_hash"],
			row["alias_raw"],
			row["alias_source"],
		)
		for row in rows
	]
	cur = db.cursor()
	try:
		cur.executemany(sql, payload)
	finally:
		cur.close()


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
	preprocess = Path.home() / "preprocess"

	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--source", default="mysql", choices=["csv", "mysql", "json"])
	parser.add_argument("--source-csv", type=Path, help="Path to raw CSV input when --source=csv")
	parser.add_argument("--source-json", type=Path, help="Path to JSON input when --source=json")
	parser.add_argument("--source-table", default="mof_entry", help="MySQL source table when --source=mysql")
	parser.add_argument("--source-where", help="Optional SQL WHERE clause for source=mysql")

	parser.add_argument("--name2smiles", default=preprocess / "name2smiles_1222.json", type=Path)
	parser.add_argument("--smiles2name", default=preprocess / "smiles2name_1222.json", type=Path)

	parser.add_argument("--mysql-host", default=os.environ.get("MYSQL_HOST", "127.0.0.1"))
	parser.add_argument("--mysql-port", type=int, default=int(os.environ.get("MYSQL_PORT", "3306")))
	parser.add_argument("--mysql-user", default=os.environ.get("USER"))
	parser.add_argument("--mysql-password", default=os.environ.get("MYSQL_PASSWORD"))
	parser.add_argument("--mysql-database", default=os.environ.get("MYSQL_DATABASE", "mof_app"))

	parser.add_argument("--mof-id-lookup-table", default="mof_entry")
	parser.add_argument("--skip-missing-mof-id", action="store_true")

	parser.add_argument("--mof-linkers-table", default="mof_linkers")
	parser.add_argument("--linker-lookup-table", default="linker_lookup")
	parser.add_argument("--linker-alias-lookup-table", default="linker_alias_lookup")
	parser.add_argument("--create-tables", action="store_true")
	parser.add_argument("--truncate-first", action="store_true")
	parser.add_argument("--out-dir", type=Path, help="Optional directory for debug CSV outputs")

	args = parser.parse_args(argv)
	if not args.mysql_password:
		args.mysql_password = getpass.getpass(f"Enter MySQL password for {args.mysql_user}: ")
	return args


def validate_args(args: argparse.Namespace) -> None:
	if args.source == "csv" and not args.source_csv:
		raise SystemExit("--source-csv is required when --source=csv")
	if args.source == "json" and not args.source_json:
		raise SystemExit("--source-json is required when --source=json")


def main(argv: Optional[Sequence[str]] = None) -> int:
	args = parse_args(argv)
	validate_args(args)

	name2smiles_raw = load_json(args.name2smiles)
	smiles2name_raw = load_json(args.smiles2name)
	if not isinstance(name2smiles_raw, dict):
		raise ValueError("name2smiles JSON must be an object/dict")
	if not isinstance(smiles2name_raw, dict):
		raise ValueError("smiles2name JSON must be an object/dict")

	alias_to_smiles, smiles_to_aliases = build_alias_maps(name2smiles_raw, smiles2name_raw)

	db = connect_mysql(args)
	skipped_source_records: List[Dict[str, Any]] = []
	try:
		if args.source == "mysql":
			records = load_records_from_mysql(db, args.source_table, args.source_where)
		elif args.source == "csv":
			raw_records = load_records_from_csv(args.source_csv)
			id_lookup = build_mof_id_lookup(db, args.mof_id_lookup_table)
			records, skipped_source_records = attach_mof_ids(raw_records, id_lookup, args.skip_missing_mof_id)
		else:
			raw_records = load_records_from_json(args.source_json)
			id_lookup = build_mof_id_lookup(db, args.mof_id_lookup_table)
			records, skipped_source_records = attach_mof_ids(raw_records, id_lookup, args.skip_missing_mof_id)

		mof_linkers_rows, linker_lookup_rows, alias_rows, unresolved_rows, alias_collisions = build_outputs(
			records, alias_to_smiles, smiles_to_aliases
		)

		if args.create_tables:
			create_tables(
				db,
				args.mof_linkers_table,
				args.linker_lookup_table,
				args.linker_alias_lookup_table,
			)
		if args.truncate_first:
			clear_tables(
				db,
				args.mof_linkers_table,
				args.linker_lookup_table,
				args.linker_alias_lookup_table,
			)

		insert_linker_lookup_rows(db, args.linker_lookup_table, linker_lookup_rows)
		insert_mof_linker_rows(db, args.mof_linkers_table, mof_linkers_rows)
		insert_alias_rows(db, args.linker_alias_lookup_table, alias_rows)
		db.commit()
	except Exception:
		db.rollback()
		raise
	finally:
		db.close()

	if args.out_dir:
		write_csv(
			args.out_dir / "mof_linkers.csv",
			mof_linkers_rows,
			[
				"mof_id",
				"linker_position",
				"linker_name",
				"linker_abbr",
				"canonical_smiles",
				"canonical_smiles_hash",
				"display_name",
				"aliases_json",
				"matched_by",
				"resolution_status",
				"candidate_smiles_json",
			],
		)
		write_csv(
			args.out_dir / "linker_lookup.csv",
			linker_lookup_rows,
			[
				"canonical_smiles_hash",
				"canonical_smiles",
				"display_name",
				"aliases_json",
			],
		)
		write_csv(
			args.out_dir / "linker_alias_lookup.csv",
			alias_rows,
			[
				"alias_normalized",
				"canonical_smiles_hash",
				"alias_raw",
				"alias_source",
			],
		)
		write_csv(
			args.out_dir / "unresolved_linkers.csv",
			unresolved_rows,
			[
				"mof_id",
				"linker_position",
				"linker_name",
				"linker_abbr",
				"matched_by",
				"resolution_status",
				"candidate_smiles_json",
			],
		)
		if skipped_source_records:
			write_csv(
				args.out_dir / "skipped_source_records.csv",
				skipped_source_records,
				sorted({key for row in skipped_source_records for key in row.keys()}),
			)
		if alias_collisions:
			write_csv(
				args.out_dir / "alias_collisions.csv",
				alias_collisions,
				[
					"alias_normalized",
					"canonical_smiles_hash",
					"kept_alias_raw",
					"kept_alias_source",
					"discarded_alias_raw",
					"discarded_alias_source",
					"reason",
				],
			)

	total = len(mof_linkers_rows)
	resolved = sum(1 for row in mof_linkers_rows if row["resolution_status"] == "resolved")
	ambiguous = sum(1 for row in mof_linkers_rows if row["resolution_status"] == "ambiguous")
	unresolved = sum(1 for row in mof_linkers_rows if row["resolution_status"] == "unresolved")

	print(f"Source mode: {args.source}")
	print(f"Records processed: {len(records)}")
	print(f"Source records skipped for missing mof_id: {len(skipped_source_records)}")
	print(f"Linker rows upserted: {total}")
	print(f"Resolved: {resolved}")
	print(f"Ambiguous: {ambiguous}")
	print(f"Unresolved: {unresolved}")
	print(f"Lookup rows upserted: {len(linker_lookup_rows)}")
	print(f"Alias rows upserted: {len(alias_rows)}")
	print(f"Alias collisions collapsed during build: {len(alias_collisions)}")
	print(
		"Target tables: "
		f"{args.linker_lookup_table}, {args.mof_linkers_table}, {args.linker_alias_lookup_table}"
	)
	if args.out_dir:
		print(f"Debug CSV output directory: {args.out_dir}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

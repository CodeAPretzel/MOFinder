import getpass
import hashlib
import json
import os
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import mysql.connector


MOFS_PATH = "/home/zhenglab/preprocess/mofs.csv"

# Get MySQL Password from user
MYSQL_PASSWORD = getpass.getpass("Enter MySQL Password for DB Access: ")

DB = {
    "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
    "user": os.environ.get("USER"),
    "password": MYSQL_PASSWORD,
    "database": os.environ.get("MYSQL_DATABASE", "mof_app"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
}


###########
# Helpers #
###########


def to_bool(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip().lower()
    return s in {"true", "yes", "y", "1"}


def to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)) and pd.notna(v):
        return float(v)
    s = str(v).strip()
    if s == "" or s.lower() == "nan":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def none_if_nan(v: Any) -> Optional[Any]:
    if v is None:
        return None
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s != "" else None


def capitalize_first_letter(v: Any) -> Optional[str]:
    v_clean = none_if_nan(v)
    if not v_clean:
        return None

    s = v_clean.lstrip()  # Preserve leading spaces separately
    if not s:
        return v_clean

    # Find first alphabetical character
    for i, char in enumerate(s):
        if char.isalpha():
            return v_clean[:len(v_clean) - len(s)] + s[:i] + char.upper() + s[i+1:]

    return v_clean  # No alphabetical character found


def derive_crystal_form(v: Any) -> Optional[str]:
    v_clean = none_if_nan(v)
    if not v_clean:
        return None

    if "powder" in v_clean.lower():
        return "Powder"

    return "Single Crystal"


def derive_mof_name(row: Dict[str, Any]) -> Optional[str]:
    # Existing name
    existing = none_if_nan(row.get("mof_name"))
    if existing:
        return existing

    # Try abbreviations first
    metal = none_if_nan(row.get("metal_1_abbr")) or none_if_nan(row.get("metal_1"))
    linker = none_if_nan(row.get("linker_1_abbr")) or none_if_nan(row.get("linker_1"))

    if metal and linker:
        return f"{metal}-{linker}"

    return None


def clean_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    if isinstance(obj, float) and pd.isna(obj):
        return None
    return obj


def normalize_for_mysql(v: Any) -> Any:
    # Convert pandas/numpy NaN to None
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    # Convert numpy types to plain python (optional but helpful)
    if hasattr(v, "item"):
        try:
            return v.item()
        except Exception:
            pass
    return v


##############
# Main Logic #
##############


def make_mof_key_from_row(row: Dict[str, Any]) -> str:
    cleaned = clean_for_json(row)
    payload = json.dumps(cleaned, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def preprocess_csv_row(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    # Identifiers
    doi_clean = none_if_nan(row.get("doi"))
    mof_name_clean = derive_mof_name(row)

    mof_key = make_mof_key_from_row(row)

    # Map CSV -> entry (largely aligned with output.json keys)
    entry = {
        "doi": doi_clean,
        "mof_name": mof_name_clean,
        "mof_key": mof_key,

        "mof_description": capitalize_first_letter(row.get("mof_description")),
        "metal_1": none_if_nan(row.get("metal_1")),
        "metal_1_abbr": none_if_nan(row.get("metal_1_abbr")),
        "linker_1": none_if_nan(row.get("linker_1")),
        "linker_1_abbr": none_if_nan(row.get("linker_1_abbr")),
        "topology_code": none_if_nan(row.get("topology_code")),
        "solvent_main": none_if_nan(row.get("solvent_main")),
        "temperature_c": to_float(row.get("temperature_c")),
        "time_h": to_float(row.get("time_h")),
        "yield_percent": to_float(row.get("yield_percent")),
        "bet_surface_area_m2g": to_float(row.get("BET_surface_area_m2g")),
        "pore_diameter_A": to_float(row.get("pore_diameter_A")),
        "tga_decomposition_temp_c": to_float(row.get("tga_decomposition_temp_c")),
        "water_stable": to_bool(row.get("water_stable")),
        "air_stable": to_bool(row.get("air_stable")),
        "crystal_morphology": none_if_nan(row.get("crystal_morphology")),
        "crystal_form": derive_crystal_form(row.get("crystal_morphology")),
        "status": none_if_nan(row.get("status")),
        "synthesis_procedure": none_if_nan(row.get("synthesis_procedure")),
        "activation_procedure": none_if_nan(row.get("activation_text")),

        "raw_csv": json.dumps(clean_for_json(row), ensure_ascii=False, allow_nan=False),
    }

    # Optional: SMILES (not in your sample row, but supported)
    smiles_rows: List[Dict[str, Any]] = []
    # Example if you later add columns like linker_1_smiles, linker_2_smiles...
    for i in (1, 2, 3):
        smi = row.get(f"linker_{i}_smiles")
        name = row.get(f"linker_{i}")
        if smi:
            smiles_rows.append({
                "role": "linker",
                "name": name or None,
                "smiles": str(smi).strip(),
            })

    # Optional: AI results (not in your sample row, but supported)
    ai_rows: List[Dict[str, Any]] = []
    # Example if you later add ai_model, ai_target, ai_value columns
    if row.get("ai_model") and row.get("ai_value") is not None:
        ai_rows.append({
            "model_name": str(row["ai_model"]),
            "model_version": str(row.get("ai_version") or ""),
            "target": str(row.get("ai_target") or ""),
            "value": to_float(row.get("ai_value")),
            "units": str(row.get("ai_units") or ""),
            "extra": json.dumps({}),
        })

    return entry, smiles_rows, ai_rows


def upsert_mof(cur, entry: Dict[str, Any]) -> int:
    # Ensure deterministic ordering
    cols = list(entry.keys())
    col_list = ", ".join(cols)
    placeholders = ", ".join([f"%({c})s" for c in cols])

    # Build update clause for all cols except the unique key you upsert on
    # If you're using mof_key as unique key, don't update it.
    update_cols = [c for c in cols if c not in ("mof_key",)]
    update_clause = ",\n          ".join([f"{c}=VALUES({c})" for c in update_cols]) + ",\n          updated_at=CURRENT_TIMESTAMP"

    sql = f"""
        INSERT INTO mof_entry ({col_list})
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE
          {update_clause}
    """

    cur.execute(sql, entry)

    if cur.lastrowid:
        return int(cur.lastrowid)

    # Fetch id by your true unique key (preferred)
    if "mof_key" in entry and entry["mof_key"]:
        cur.execute("SELECT id FROM mof_entry WHERE mof_key=%s", (entry["mof_key"],))
    else:
        # fallback (not ideal if DOI isn't unique)
        cur.execute("SELECT id FROM mof_entry WHERE doi=%s AND mof_name=%s LIMIT 1", (entry.get("doi"), entry.get("mof_name")))
    return int(cur.fetchone()[0])


def main() -> None:
    df = pd.read_csv(MOFS_PATH)
    if "doi" not in df.columns or "mof_name" not in df.columns:
        raise RuntimeError("CSV must include at least doi and mof_name columns")

    conn = mysql.connector.connect(**DB)
    conn.autocommit = False

    try:
        cur = conn.cursor()

        print("Starting preprocessing now...")

        for _, r in df.iterrows():
            row = r.to_dict()
            entry, smiles_rows, ai_rows = preprocess_csv_row(row)

            entry = {k: normalize_for_mysql(v) for k, v in entry.items()}

            # Fail if leaked NaN
            for k, v in entry.items():
                if isinstance(v, float) and pd.isna(v):
                    raise ValueError(f"NaN leaked into entry field: {k}")

            if not entry.get("doi"):
                print(f"Row missing doi; inserting anyway (doi={entry.get('doi')}, mof_name={entry.get('mof_name')})")

            mof_id = upsert_mof(cur, entry)

            # Insert related rows (you can choose replace semantics later)
            for s in smiles_rows:
                cur.execute(
                    "INSERT INTO mof_smiles (mof_id, role, name, smiles) VALUES (%s, %s, %s, %s)",
                    (mof_id, s.get("role"), s.get("name"), s["smiles"]),
                )

            for a in ai_rows:
                cur.execute(
                    """
                    INSERT INTO mof_ai_result (mof_id, model_name, model_version, target, value, units, extra)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (mof_id, a["model_name"], a.get("model_version") or None, a.get("target") or None,
                     a.get("value"), a.get("units") or None, a.get("extra")),
                )

        conn.commit()
        print("Loaded CSV into MySQL successfully.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()

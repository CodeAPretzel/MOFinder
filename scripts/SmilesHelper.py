#!/usr/bin/env python3
import json
import sys
from typing import Any, Dict

from rdkit import Chem # type: ignore
from rdkit.Chem.MolStandardize import rdMolStandardize # type: ignore


def canonicalize_smiles(smiles: str) -> Dict[str, Any]:
    smiles = (smiles or "").strip()
    if not smiles:
        return {
            "ok": False,
            "error": "Empty SMILES",
            "input": smiles,
            "canonical_smiles": None,
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {
            "ok": False,
            "error": "RDKit could not parse SMILES",
            "input": smiles,
            "canonical_smiles": None,
        }

    # Standardize, but do not yet collapse to charge parent by default.
    # Cleanup() standardizes a molecule according to RDKit's normalization rules.
    mol = rdMolStandardize.Cleanup(mol)

    canonical = Chem.MolToSmiles(
        mol,
        canonical=True,
        isomericSmiles=True,
        kekuleSmiles=False,
    )

    return {
        "ok": True,
        "error": None,
        "input": smiles,
        "canonical_smiles": canonical,
    }


def main() -> int:
    if len(sys.argv) > 1:
        smiles = sys.argv[1]
    else:
        payload = json.load(sys.stdin)
        smiles = payload.get("smiles", "")

    result = canonicalize_smiles(smiles)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
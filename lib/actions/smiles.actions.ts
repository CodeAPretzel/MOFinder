import { createHash } from "crypto";
import { getServerRDKit } from "@/lib/actions/rdkit.actions";

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export type CanonicalizeSmilesResult =
	| {
		ok: true;
		input: string;
		canonicalSmiles: string;
		canonicalSmilesHash: string;
	}
	| {
		ok: false;
		input: string;
		error: string;
	};

export async function canonicalizeSmiles(
	input: string
): Promise<CanonicalizeSmilesResult> {
	const smiles = input.trim();

	if (!smiles) {
		return {
			ok: false,
			input,
			error: "Empty SMILES",
		};
	}

	const RDKit = await getServerRDKit();
	const mol = RDKit.get_mol(smiles);

	if (!mol) {
		return {
			ok: false,
			input,
			error:
				"Invalid SMILES. If you intended a methyl or alkyl substituent, use uppercase C rather than lowercase aromatic c.",
		};
	}

	try {
		const canonicalSmiles = mol.get_smiles();

		if (!canonicalSmiles) {
			return {
				ok: false,
				input,
				error: "RDKit parsed the SMILES but could not generate a canonical form.",
			};
		}

		return {
			ok: true,
			input,
			canonicalSmiles,
			canonicalSmilesHash: sha256(canonicalSmiles),
		};
	} finally {
		mol.delete();
	}
}
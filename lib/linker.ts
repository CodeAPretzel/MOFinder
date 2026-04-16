export function normalizeLinkerInput(input: string): string {
	return input
		.trim()
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201C\u201D]/g, '"')
		.replace(/[\u2013\u2014]/g, "-")
		.replace(/\s+/g, " ")
		.toLowerCase();
}

export function looksLikeSmiles(input: string): boolean {
	const trimmed = input.trim();
	if (!trimmed) return false;

	// Short linker abbreviations / labels should not be treated as SMILES.
	// Examples: Hmim, BDC, BTC, bpy, dabco
	if (/^[A-Za-z][A-Za-z0-9_-]{1,15}$/.test(trimmed)) {
		return false;
	}

	// Strong SMILES indicators
	if (/[=#@\[\]\(\)\\/]/.test(trimmed)) return true;
	if (/\d/.test(trimmed)) return true;

	// Atom/aromatic-token-only strings can still be SMILES,
	// but avoid classifying plain words/abbreviations as SMILES.
	if (/^[BCNOPSFIbcnohpsif0-9@+\-\[\]\(\)=#$\\/.]+$/.test(trimmed)) {
		return true;
	}

	return false;
}
import {
	FILTER_DEFINITIONS,
	LINKER_SMILES_HASH_PARAM
} from "@/constants";

export async function resolveMofInput(filters: FilterState, page: number, pageSize = 9, doi?: string) {
	const params = new URLSearchParams();
	params.set("page", String(page))
	params.set("pageSize", String(pageSize))

	if (doi) params.set("doi", doi);

	// Filter with linker-smiles-hash in DB
	if (filters.linkerSmilesHash) {
		params.set(LINKER_SMILES_HASH_PARAM, filters.linkerSmilesHash);
	}

	// Normalize object entires with FILTER_DEFINITIONS
	for (const [key, def] of Object.entries(FILTER_DEFINITIONS)) {
		const value = (filters as any)[key];

		// skip defaults / empties
		if (value == null || value === "" || value === false) continue;

		// Skip default 0 for numeric filters
		if (typeof value === "number" && value === 0) continue;

		if (def.kind === "boolean") {
			params.set(def.param, value ? "1" : "0");
		} else {
			params.set(def.param, String(value));
		}
	}

	const res = await fetch(`/api/mof?${params.toString()}`);

	if (!res.ok) {
		throw new Error(`Failed to fetch MOFs (${res.status})`);
	}

	return res.json() as Promise<{
		total: number;
		page: number;
		pageSize: number;
		data: MofEntry[]
	}>;
}
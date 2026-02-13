import { FILTER_DEFS } from "@/lib/utils";

export async function MofMysqlHandler(filters: FilterState, page: number, pageSize = 9, doi?: string) {
	const params = new URLSearchParams();
	params.set("page", String(page))
	params.set("pageSize", String(pageSize))

	if (doi) params.set("doi", doi);

	for (const [key, def] of Object.entries(FILTER_DEFS)) {
		const value = (filters as any)[key];

		// skip defaults / empties
		if (value == null || value === "" || value === false) continue;

		params.set(def.param, String(value));
	}

	const res = await fetch(`/api/aws?${params.toString()}`);

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
export const FILTER_DEFS = {
	// search query across multiple fields (special)
	searchQuery: { kind: "search", param: "searchQuery" },

	// numeric thresholds
	minSurfaceArea: { kind: "numberMin", param: "minSurfaceArea", field: "bet_surface_area_m2g" },
	minPoreDiameter: { kind: "numberMin", param: "minPoreDiameter", field: "pore_diameter_A" },
	minTgaTemp: { kind: "numberMin", param: "minTgaTemp", field: "tga_decomposition_temp_c" },
	maxTemperature: { kind: "numberMax", param: "maxTemperature", field: "temperature_c" },
	maxTime: { kind: "numberMax", param: "maxTime", field: "time_h" },

	// booleans
	waterStable: { kind: "boolean", param: "waterStable", field: "water_stable" },
	airStable: { kind: "boolean", param: "airStable", field: "air_stable" },

	// equals filters
	topology: { kind: "stringEq", param: "topology", field: "topology_code" },
	metal: { kind: "stringEq", param: "metal", field: "metal_1_abbr" },
} as const satisfies Record<string, FilterKind>;

export const PARSE_NUMBER = (v: string | null): number | null => {
	if (v == null || v === "") return null;

	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

export const PARSE_BOOL = (v: string | null): boolean => {
	if (!v) return false;
	const s = v.trim().toLowerCase();
	return s === "true" || s === "1" || s === "yes" || s === "on";
}

export async function STREAM_TO_STRING(stream: any): Promise<string> {
	if (stream?.transformToString) return await stream.transformToString();
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf-8");
}
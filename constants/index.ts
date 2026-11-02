export const FILTER_DEFINITIONS = {
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

export const FILTER_DEFAULT_STATE: FilterState = {
	searchQuery: '',
	minSurfaceArea: 0,
	minPoreDiameter: 0,
	maxTemperature: 0,
	maxTime: 0,
	minTgaTemp: 0,
	waterStable: false,
	airStable: false,
	topology: '',
	metal: '',
	linkerQuery: '',
	linkerSmilesHash: '',
	linkerDisplayName: '',
};

export const LINKER_SMILES_HASH_PARAM = "linkerSmilesHash";

// Synthesis conditions scored by the AI model, in display order
export const AI_PREDICTION_FIELDS: Array<{
	key: AiPredictionField;
	label: string;
	unit?: string;
	numeric: boolean;
}> = [
	{ key: "metal_precursor", label: "Metal precursor", numeric: false },
	{ key: "organic_linker", label: "Organic linker", numeric: false },
	{ key: "modulator", label: "Modulator", numeric: false },
	{ key: "solvent", label: "Solvent", numeric: false },
	{ key: "metal_concentration_mM", label: "Metal concentration", unit: "mM", numeric: true },
	{ key: "M_L_ratio", label: "Metal : linker ratio", numeric: true },
	{ key: "temperature_C", label: "Temperature", unit: "°C", numeric: true },
	{ key: "time_h", label: "Time", unit: "h", numeric: true },
];

export const AI_PREDICTION_TOP_LIMIT = 10;

export const METALS = [
	'Zn',
	'Zr',
	'Cu',
	'Cr',
	'Al',
	'Mg',
	'Co',
	'Ni',
	'Fe',
	'Mn',
	'V',
];

export const TOPOLOGIES = [
	'pcu',
	'fcu',
	'tbo',
	'mtn',
	'sod',
	'csq',
	'nbo',
	'bcu',
	'loi',
	'she',
	'rht',
	'acs',
	'the',
];
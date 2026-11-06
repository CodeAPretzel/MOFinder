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

// Most recipes one submit can score (they run one at a time)
export const AI_PREDICTION_LIVE_MAX_RECIPES = 10;

// Names are typed; the model server takes names up to this length
export const AI_PREDICTION_TEXT_MAX_LENGTH = 100;
export const AI_PREDICTION_TEXT_FIELDS: AiPredictionTextField[] = ["metal_precursor", "organic_linker", "modulator", "solvent"];

// How the site and the model server spell "no modulator" (a blank modulator box means this)
export const AI_PREDICTION_NO_MODULATOR = "none";

// Starting numbers for a new recipe
export const AI_PREDICTION_DEFAULT_NUMBERS: Record<AiPredictionNumericField, string> = {
	metal_concentration_mM: "50",
	M_L_ratio: "1",
	temperature_C: "120",
	time_h: "24",
};

// Numbers users may type: 1st-99th percentiles of the training data, rounded outward
export const AI_PREDICTION_NUMERIC_RANGES: AiPredictionNumericRanges = {
	metal_concentration_mM: { min: 2, max: 2000, step: 1 },
	M_L_ratio: { min: 0.05, max: 20, step: 0.05 },
	temperature_C: { min: 20, max: 220, step: 1 },
	time_h: { min: 0.5, max: 360, step: 0.5 },
};

export const AI_PREDICTION_FULL_MODEL_URL = "https://huggingface.co/StarLiu714/GPT-oss-MOFinder";

// What the popup says for each live-model error. The API route sends these, and
// the browser falls back to them when nginx answers with its own error page.
export const AI_PREDICTION_LIVE_MESSAGES: Record<AiPredictionErrorCode, string> = {
	invalid: "The live model could not read this recipe.",
	rate_limited: "Too many live predictions from your connection. Please wait a moment and try again.",
	busy: "The model is busy. Please try again in a minute.",
	offline: "The live model is offline right now.",
	timeout: "The live model took too long to answer (it may be busy). Please try again in a minute.",
	model_error: "The live model could not score this recipe. Please try again later.",
};

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
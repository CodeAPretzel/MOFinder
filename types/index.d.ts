/* eslint-disable no-unused-vars */

// declare type AiMetrics = {
// 	synthesizability: number;
// 	water_stability_score: number;
// 	thermal_stability_score: number;
// };

declare type AiPredictionField =
	| "metal_precursor"
	| "organic_linker"
	| "modulator"
	| "solvent"
	| "metal_concentration_mM"
	| "M_L_ratio"
	| "temperature_C"
	| "time_h";

// One full set of synthesis conditions (a "recipe") the model scores
declare type SynthesisRecipe = {
	metal_precursor: string;
	organic_linker: string;
	modulator: string;
	solvent: string;
	metal_concentration_mM: number;
	M_L_ratio: number;
	temperature_C: number;
	time_h: number;
};

declare type SynthesisPrediction = {
	recipe: SynthesisRecipe;
	score: number;
	pred: "P" | "N";
	model: string;
	latencyMs?: number;
	cached?: boolean;
};

declare type AiPredictionTextField = "metal_precursor" | "organic_linker";

declare type AiPredictionChoiceField = "modulator" | "solvent";

declare type AiPredictionNumericField = "metal_concentration_mM" | "M_L_ratio" | "temperature_C" | "time_h";

declare type AiPredictionNumericRanges = {
	[K in AiPredictionNumericField]: { min: number; max: number; step: number };
};

declare type AiPredictionLiveStatus = "online" | "offline" | "busy";

declare type AiPredictionStatus = {
	live: AiPredictionLiveStatus;
};

// Why a live prediction failed, so the popup can show a matching message
declare type AiPredictionErrorCode = "invalid" | "rate_limited" | "busy" | "offline" | "timeout" | "model_error";

declare type CanonicalizeSmilesResult =
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

declare type FilterKind =
	| { kind: "search"; param: string }
	| { kind: "numberMin" | "numberMax"; param: string; field: string }
	| { kind: "boolean"; param: string; field: string }
	| { kind: "stringEq"; param: string; field: string };

declare type FilterState = {
	searchQuery: string;
	minSurfaceArea: number;
	minPoreDiameter: number;
	maxTemperature: number;
	maxTime: number;
	minTgaTemp: number;
	waterStable: boolean;
	airStable: boolean;
	topology: string;
	metal: string;
	linkerQuery: string;
	linkerSmilesHash: string;
	linkerDisplayName: string;
}

declare type JSAppletNamespace = {
	JSME: new (
		containerId: string,
		width: string,
		height: string,
		params?: Record<string, string>
	) => JSMEInstance;
}

declare type JSMEEvent = {
	src: JSMEInstance;
	action?: string;
	atom?: number;
	bond?: number;
	molecule?: number;
	argument?: unknown;
}

declare type JSMEInstance = {
	smiles: () => string;
	setCallBack?: (
		callbackName: string,
		callbackFn: (event: JSMEEvent) => void
	) => void;
	setMolecularAreaScale?: (scale: number) => void;
	setMenuScale?: (scale: number) => void;
	repaint?: () => void;
};

declare type LinkerResolveResponse = {
	query: string;
	normalizedQuery: string;
	inputMode: "smiles" | "alias";
	matched: boolean;
	canonicalSmilesHash: string | null;
	canonicalSmiles: string | null;
	displayName: string | null;
	aliases: string[];
	suggestions: Array<{
		canonicalSmilesHash: string;
		canonicalSmiles: string;
		displayName: string | null;
	}>;
	canonicalizationError?: string | null;
};

declare type MofEntry = {
	id: number;
	doi: string;
	mof_name: string;
	mof_description: string;
	metal_1: string;
	metal_1_abbr: string;
	linker_1: string;
	linker_1_abbr: string;
	topology_code: string;
	solvent_main: string;
	temperature_c: number;
	time_h: number;
	yield_percent: number;
	bet_surface_area_m2g: number;
	pore_diameter_A: number;
	tga_decomposition_temp_c: number;
	water_stable: boolean;
	air_stable: boolean;
	crystal_morphology: string;
	crystal_form: 'Single Crystal' | 'Powder' | 'Reported';
	status: string;
	synthesis_procedure: string;
	activation_procedure: string;
}

//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////

declare interface AiPredictionsProps {
  isOpen: boolean;
  onClose: () => void;
}

declare interface DetailModalProps {
	mof: MofEntry;
	onClose: () => void;
}

declare interface FilterSidebarProps {
	filters: FilterState;
	setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
	resultsCount: number;
}

declare interface HeaderProps {
	isDarkMode: boolean;
	toggleTheme: () => void;
	onAiPredictionsClick: () => void;
}

declare interface JSMEEditorProps {
	initialSmiles?: string;
	onSmilesChange?: (smiles: string) => void;
	className?: string;
}

declare interface MofCardProps {
	mof: MofEntry;
	onClick: (mof: MofEntry) => void;
}

declare interface MofPaginationProps {
	data: MofEntry[];
	total: number;
	page: number;
	pageSize?: number;
	onPageChange: (page: number) => void;
	onCardClick: (mof: MofEntry) => void;
}

declare interface PaginationProps {
	page: number;
	totalPages: number;
}

declare interface SearchParamProps {
	params: { [key: string]: string };
	searchParams: { [key: string]: string | string[] | undefined };
};

declare interface SmilesEditorProps {
	value: string;
	resolvedDisplayName: string;
	resolvedSmilesHash: string;
	onChange: (value: string) => void;
	onResolved: (result: import("@/lib/linkerResolver").LinkerResolveResponse) => void;
	onClear: () => void;
};

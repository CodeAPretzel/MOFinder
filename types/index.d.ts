/* eslint-disable no-unused-vars */

declare type AiMetrics = {
	synthesizability: number;
	water_stability_score: number;
	thermal_stability_score: number;
};

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

// declare interface AiAssistantProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

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
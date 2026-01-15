/* eslint-disable no-unused-vars */

declare type SearchParamProps = {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

declare type MofEntry = {
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

declare type AiMetrics = {
  synthesizability: number;
  water_stability_score: number;
  thermal_stability_score: number;
};

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
}

declare interface PaginationProps {
  page: number;
  totalPages: number;
}

declare interface MofPaginationProps {
  data: MofEntry[];
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onCardClick: (mof: MofEntry) => void;
}

declare interface DetailModalProps {
  mof: MofEntry;
  onClose: () => void;
}

declare interface MofCardProps {
  mof: MofEntry;
  onClick: (mof: MofEntry) => void;
}

declare interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

declare interface FilterSidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resultsCount: number;
}

// declare interface AiAssistantProps {
//   isOpen: boolean;
//   onClose: () => void;
// }
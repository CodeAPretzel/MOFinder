import { any } from "zod";

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

export const MOF_DATA: MofEntry[] = [
  // This is a mock setup for testing
  // {
  //   doi: "10.1038/nature00000",
  //   mof_name: "MOF-5",
  //   mof_description: "Canonical zinc-carboxylate MOF consisting of Zn4O clusters linked by 1,4-benzenedicarboxylate. Prototypical pcu topology.",
  //   metal_1: "Zinc Nitrate Tetrahydrate",
  //   metal_1_abbr: "Zn",
  //   linker_1: "1,4-benzenedicarboxylic acid",
  //   linker_1_abbr: "H2BDC",
  //   topology_code: "pcu",
  //   solvent_main: "DEF",
  //   temperature_c: 105,
  //   time_h: 20,
  //   yield_percent: 88,
  //   bet_surface_area_m2g: 3500,
  //   pore_diameter_A: 12.9,
  //   tga_decomposition_temp_c: 400,
  //   water_stable: false,
  //   air_stable: false,
  //   crystal_morphology: "Cubic blocks",
  //   crystal_form: "Single Crystal",
  //   status: "ok",
  //   synthesis_procedure: "Zn(NO3)2·4H2O (0.80 g) and H2BDC (0.20 g) were dissolved in diethylformamide (DEF, 20 mL) in a glass jar. The vessel was tightly capped and heated in a convection oven at 105 °C for 20 hours. Clear cubic crystals formed on the walls and bottom of the jar.",
  //   activation_procedure: "The crystals were washed with DMF (3x10 mL) and chloroform (3x10 mL). The solvent was exchanged with fresh chloroform every 24h for 3 days. Finally, the sample was evacuated at room temperature for 12h, then at 120°C for 12h under dynamic vacuum.",
  // },
]

export const MOCK_AI_METRICS: AiMetrics[] = [
  {
    synthesizability: 95,
    water_stability_score: 15,
    thermal_stability_score: 85,
  },
]
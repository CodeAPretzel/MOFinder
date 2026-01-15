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

export const MOF_DATA: MofEntry[] = []

export const MOCK_AI_METRICS: AiMetrics[] = [
  {
    synthesizability: 95,
    water_stability_score: 15,
    thermal_stability_score: 85,
  },
]
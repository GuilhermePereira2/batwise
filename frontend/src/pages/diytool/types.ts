import type { Configuration as BaseConfiguration, Component, Cable, CellData } from "@/types";

export interface SafetyAssessment {
  is_safe: boolean;
  safety_score: number;
  warnings: string[];
  recommendations: string[];
}

export interface ComponentData extends Component {
  vdc_max?: number;
  a_max?: number;
  master_price?: number;
  slave_price?: number;
  max_cells?: number;
  price: number;
  link: string;
}

export interface CableData extends Cable {
  brand?: string;
  vdc_max?: number;
  a_max?: number;
  link: string;
}

export interface Configuration extends BaseConfiguration {
  cell: CellData;
  continuous_power: number;
  safety: SafetyAssessment;
  fuse: ComponentData | null;
  relay: ComponentData | null;
  bms: ComponentData | null;
  shunt: ComponentData | null;
  cable: CableData | null;
}

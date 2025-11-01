export interface CellData {
    Brand: string;
    CellModelNo: string;
    Composition: string;
    MaxContinuousDischargeRate: number;
    MaxContinuousChargeRate: number;
    NominalVoltage: number;
    Capacity: number;
    Weight: number;
    Cell_Thickness: number;
    Cell_Width: number;
    Cell_Height: number;
    Connection?: string; // Link de afiliado da célula
    Price: number;
}

export interface Component {
    brand: string;
    model: string;
    vdc_max?: number;
    a_max?: number;
    price?: number;
    master_price?: number; // Específico para BMS
    link: string;
}

export interface Cable {
    model: string;
    section: number;
    price: number;
    link: string;
}

export interface Configuration {
    cell: CellData;
    series_cells: number;
    parallel_cells: number;
    battery_voltage: number;
    battery_capacity: number;
    battery_energy: number;
    battery_weight: number;
    battery_impedance: number;
    peak_power: number;
    total_price: number;
    fuse: Component | null;
    relay: Component | null;
    cable: Cable | null;
    bms: Component | null;
    shunt: Component | null;
}

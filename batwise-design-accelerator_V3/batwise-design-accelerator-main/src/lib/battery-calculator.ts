// src/lib/battery-calculator.ts

export interface CellData {
  Brand: string;
  CellModelNo: string;
  Composition: string;
  Cell_Stack: string;
  MaxContinuousDischargeRate: number;
  MaxContinuousChargeRate: number;
  NominalVoltage: number;
  ChargeVoltage: number;
  Capacity: number;
  TheMaxDischargeCurrentOfTheTabs: number;
  Impedance: number;
  Weight: number;
  Cell_Thickness: number;
  Cell_Width: number;
  Cell_Height: number;
  TabsThickness: number;
  TabsWidth: number;
  TabsLength: number;
  DistanceBetweenTwoTabs: number;
  VolumeEnergyDensity: number;
  PowerEnergyDensity: number;
  Cycles: number;
  Price: number;
  OriginCountry: string;
  Connection: string;
}

export interface ComponentDB {
  fuses: Array<{
    brand: string;
    model: string;
    vdc_max: number;
    a_max: number;
    temp_min: number;
    temp_max: number;
    price: number;
    link: string;
  }>;
  relays: Array<{
    brand: string;
    model: string;
    vdc_max: number;
    a_max: number;
    temp_min: number;
    temp_max: number;
    price: number;
    link: string;
  }>;
  cables: Array<{
    brand: string;
    model: string;
    section: number;
    vdc_max: number;
    a_max: number;
    temp_min: number;
    temp_max: number;
    price: number;
    link: string;
  }>;
  bms: Array<{
    brand: string;
    model: string;
    max_cells: number;
    vdc_min: number;
    vdc_max: number;
    a_max: number;
    temp_min: number;
    temp_max: number;
    master_price: number;
    slave_price: number;
    link: string;
  }>;
  shunts: Array<{
    brand: string;
    model: string;
    vdc_max: number;
    a_max: number;
    temp_min: number;
    temp_max: number;
    price: number;
    link: string;
  }>;
}

type Fuse = ComponentDB['fuses'][0];
type Relay = ComponentDB['relays'][0];
type Cable = { model: string; section: number; price: number; link: string };
type Bms = ComponentDB['bms'][0];
type Shunt = ComponentDB['shunts'][0];

export interface Requirements {
  Min_Max_Voltage: number;
  Max_Max_Voltage: number;
  Min_Rated_Energy: number;
  Continuous_Power: number;
  Battery_max_weight: number;
  Max_Price: number;
  max_x: number;
  max_y: number;
  max_z: number;
  T_amb: number;
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
  continuous_power: number;
  peak_power: number;
  cell_price: number;
  fuse: Fuse | null;
  relay: Relay | null;
  cable: Cable | null;
  bms: Bms | null;
  shunt: Shunt | null;
  total_price: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  affiliate_link: string;
}

// --- DATA CONSTANTS ---

const COMPONENT_DB: ComponentDB = {
  fuses: [
    { brand: "Littelfuse Inc", model: "0999030.ZXN", vdc_max: 58, a_max: 30, temp_min: -40, temp_max: 125, price: 3.32, link: "" },
    { brand: "ESKA", model: "340027-80V", vdc_max: 80, a_max: 30, temp_min: -40, temp_max: 125, price: 3.21, link: "" },
    { brand: "Littelfuse Inc", model: "0HEV030.ZXISO", vdc_max: 450, a_max: 30, temp_min: -40, temp_max: 125, price: 24.35, link: "" },
    { brand: "HELLA", model: "8JS 742 901-051", vdc_max: 150, a_max: 100, temp_min: -40, temp_max: 125, price: 5.33, link: "" },
    { brand: "Littelfuse Inc", model: "142.5631.6102", vdc_max: 58, a_max: 100, temp_min: -40, temp_max: 125, price: 3.69, link: "" },
    { brand: "Littelfuse Inc", model: "153.5631.6151", vdc_max: 32, a_max: 150, temp_min: -40, temp_max: 125, price: 3.94, link: "" },
    { brand: "Cfriend", model: "EVAE-300A", vdc_max: 125, a_max: 300, temp_min: -40, temp_max: 125, price: 36.6, link: "" },
    { brand: "Cfriend", model: "EVAE-350A", vdc_max: 125, a_max: 350, temp_min: -40, temp_max: 125, price: 38, link: "" },
    { brand: "Cfriend", model: "EVAE-400A", vdc_max: 125, a_max: 400, temp_min: -40, temp_max: 125, price: 40, link: "" },
  ],
  relays: [
    { brand: "OZSSLJJ", model: "RL/180", vdc_max: 72, a_max: 100, temp_min: -40, temp_max: 125, price: 47, link: "" },
    { brand: "Sensata", model: "D1D100", vdc_max: 100, a_max: 100, temp_min: -40, temp_max: 125, price: 159, link: "" },
    { brand: "Innuovo", model: "INVE01-200", vdc_max: 450, a_max: 200, temp_min: -40, temp_max: 125, price: 36.36, link: "" },
  ],
  cables: [
    { brand: "feked", model: "Single Core Electric Wire Cable", section: 2, vdc_max: 12, a_max: 17.5, temp_min: -40, temp_max: 120, price: 1, link: "" },
    { brand: "TLC", model: "6491X 1.5mm²", section: 1.5, vdc_max: 15, a_max: 17, temp_min: -40, temp_max: 120, price: 0.19, link: "" },
    { brand: "TLC", model: "6491X 2.5mm²", section: 2.5, vdc_max: 24, a_max: 24, temp_min: -40, temp_max: 120, price: 0.28, link: "" },
    { brand: "TLC", model: "6491X 4mm²", section: 4, vdc_max: 32, a_max: 32, temp_min: -40, temp_max: 120, price: 0.44, link: "" },
    { brand: "Solar Shop", model: "SCBAC00662", section: 6, vdc_max: 120, a_max: 62, temp_min: -40, temp_max: 120, price: 1.87, link: "" },
    { brand: "MidSummer", model: "Solar PV Cable", section: 10, vdc_max: 1000, a_max: 80, temp_min: -40, temp_max: 120, price: 2.18, link: "" },
    { brand: "Split Charge", model: "Hi-Flex Battery Cable 16mm²", section: 16, vdc_max: 1000, a_max: 110, temp_min: -40, temp_max: 120, price: 3.3, link: "" },
    { brand: "SplitCharge", model: "Hi-Flex Battery Cable 20mm²", section: 20, vdc_max: 1000, a_max: 135, temp_min: -40, temp_max: 120, price: 3.93, link: "" },
  ],
  bms: [
    { brand: "Sensata", model: "c-BMS", max_cells: 24, vdc_min: 11, vdc_max: 120, a_max: 2000, temp_min: -40, temp_max: 125, master_price: 800, slave_price: 0, link: "" },
    { brand: "Sensata", model: "n-BMS", max_cells: 384, vdc_min: 12, vdc_max: 1000, a_max: 5000, temp_min: -40, temp_max: 125, master_price: 1000, slave_price: 200, link: "" },
  ],
  shunts: [
    { brand: "Isabellenhuette", model: "IVT-S-100", vdc_max: 1000, a_max: 120, temp_min: -40, temp_max: 105, price: 380.7, link: "" },
    { brand: "Isabellenhuette", model: "IVT-S-300", vdc_max: 1000, a_max: 320, temp_min: -40, temp_max: 105, price: 378.08, link: "" },
    { brand: "Isabellenhuette", model: "IVT-S-500", vdc_max: 1000, a_max: 730, temp_min: -40, temp_max: 105, price: 388.04, link: "" },
    { brand: "Isabellenhuette", model: "IVT-S-1000", vdc_max: 1000, a_max: 1100, temp_min: -40, temp_max: 105, price: 392.02, link: "" },
    { brand: "Isabellenhuette", model: "IVT-S-2500", vdc_max: 1000, a_max: 2700, temp_min: -40, temp_max: 105, price: 405.88, link: "" },
    { brand: "Riedon", model: "SSA-2-100A", vdc_max: 1500, a_max: 200, temp_min: -40, temp_max: 115, price: 82.42, link: "" },
    { brand: "Riedon", model: "SSA-2-250A", vdc_max: 1500, a_max: 500, temp_min: -40, temp_max: 115, price: 85.64, link: "" },
    { brand: "Riedon", model: "SSA-2-500A", vdc_max: 1500, a_max: 1000, temp_min: -40, temp_max: 115, price: 89.34, link: "" },
    { brand: "Riedon", model: "SSA-2-1000A", vdc_max: 1500, a_max: 2000, temp_min: -40, temp_max: 115, price: 93.2, link: "" },
  ],
};

export const CELL_CATALOGUE: CellData[] = [
  { Brand: "Gotion", CellModelNo: "IFP20100140A-30Ah", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 2, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 30000, TheMaxDischargeCurrentOfTheTabs: 60, Impedance: 1.5, Weight: 615, Cell_Thickness: 20, Cell_Width: 100, Cell_Height: 140, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.342857143, PowerEnergyDensity: 156.097561, Cycles: 3000, Price: 12, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Poweroad", CellModelNo: "L148N50B", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1.2, MaxContinuousChargeRate: 1, NominalVoltage: 3.7, ChargeVoltage: 4.3, Capacity: 50000, TheMaxDischargeCurrentOfTheTabs: 60, Impedance: 1.11, Weight: 860, Cell_Thickness: 26.66, Cell_Width: 148.2, Cell_Height: 101.9, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.459503894, PowerEnergyDensity: 215.1162791, Cycles: 2000, Price: 38.38, OriginCountry: "China", Connection: "L" },
  { Brand: "", CellModelNo: "ITPE60", Composition: "Unknown", Cell_Stack: "C", MaxContinuousDischargeRate: 1.2, MaxContinuousChargeRate: 1, NominalVoltage: 3.7, ChargeVoltage: 4.3, Capacity: 60000, TheMaxDischargeCurrentOfTheTabs: 72, Impedance: 1.11, Weight: 1090, Cell_Thickness: 29, Cell_Width: 149, Cell_Height: 120, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.428141634, PowerEnergyDensity: 203.6697248, Cycles: 2000, Price: 18, OriginCountry: "China", Connection: "L" },
  { Brand: "Samsung", CellModelNo: "SDI94 Li Ion 3.7V 94AH NMC", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1.6, MaxContinuousChargeRate: 0.765, NominalVoltage: 3.68, ChargeVoltage: 4.15, Capacity: 94000, TheMaxDischargeCurrentOfTheTabs: 150.4, Impedance: 0.75, Weight: 2100, Cell_Thickness: 45, Cell_Width: 173, Cell_Height: 133, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.334091491, PowerEnergyDensity: 164.7238095, Cycles: 3200, Price: 82.14, OriginCountry: "South Korea", Connection: "Solder" },
  { Brand: "", CellModelNo: "CS0600R0002a", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.7, ChargeVoltage: 4.2, Capacity: 60000, TheMaxDischargeCurrentOfTheTabs: 60, Impedance: 1.11, Weight: 1850, Cell_Thickness: 45, Cell_Width: 173, Cell_Height: 130, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.219356751, PowerEnergyDensity: 120, Cycles: 2000, Price: 18, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CATL", CellModelNo: "ND-3.7V 60Ah", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.7, ChargeVoltage: 4.3, Capacity: 60000, TheMaxDischargeCurrentOfTheTabs: 60, Impedance: 0.5, Weight: 967, Cell_Thickness: 29, Cell_Width: 148, Cell_Height: 104, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.49734748, PowerEnergyDensity: 229.5760083, Cycles: 2000, Price: 30, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF105", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 0.5, MaxContinuousChargeRate: 0.5, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 105000, TheMaxDischargeCurrentOfTheTabs: 52.5, Impedance: 0.32, Weight: 1980, Cell_Thickness: 36.35, Cell_Width: 130.3, Cell_Height: 200.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.35381486, PowerEnergyDensity: 169.6969697, Cycles: 2000, Price: 28, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF105-73103 (Rep)", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 105000, TheMaxDischargeCurrentOfTheTabs: 105, Impedance: 0.5, Weight: 1980, Cell_Thickness: 36.7, Cell_Width: 130.3, Cell_Height: 200.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.350440604, PowerEnergyDensity: 169.6969697, Cycles: 3500, Price: 25, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF22k", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.22, ChargeVoltage: 3.7, Capacity: 22000, TheMaxDischargeCurrentOfTheTabs: 22, Impedance: 0.5, Weight: 618, Cell_Thickness: 17.7, Cell_Width: 148.7, Cell_Height: 131.8, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.204210894, PowerEnergyDensity: 114.6278317, Cycles: 2000, Price: 14, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CALB", CellModelNo: "L221N113B", Composition: "Unknown", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 4.35, Capacity: 113500, TheMaxDischargeCurrentOfTheTabs: 113.5, Impedance: 1.11, Weight: 1795, Cell_Thickness: 33.36, Cell_Width: 220.8, Cell_Height: 105.88, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.465700599, PowerEnergyDensity: 202.3398329, Cycles: 1500, Price: 45, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CATL", CellModelNo: "LN52148103", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.65, ChargeVoltage: 4.2, Capacity: 114000, TheMaxDischargeCurrentOfTheTabs: 114, Impedance: 1, Weight: 1800, Cell_Thickness: 52, Cell_Width: 148, Cell_Height: 103, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.524922794, PowerEnergyDensity: 231.1666667, Cycles: 2000, Price: 48, OriginCountry: "China", Connection: "Solder" },
  { Brand: "ANC", CellModelNo: "ANC-100", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 100000, TheMaxDischargeCurrentOfTheTabs: 100, Impedance: 0.4, Weight: 2000, Cell_Thickness: 48.8, Cell_Width: 173.9, Cell_Height: 121.1, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.311376929, PowerEnergyDensity: 160, Cycles: 4000, Price: 55, OriginCountry: "China", Connection: "Solder" },
  { Brand: "BYD", CellModelNo: "C47FCSA-102", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 2.5, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 102000, TheMaxDischargeCurrentOfTheTabs: 255, Impedance: 0.35, Weight: 1990, Cell_Thickness: 49.9, Cell_Width: 160, Cell_Height: 118.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.344993785, PowerEnergyDensity: 164.0201005, Cycles: 6000, Price: 81.57, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CALB", CellModelNo: "CA-125", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 125000, TheMaxDischargeCurrentOfTheTabs: 125, Impedance: 0.9, Weight: 2450, Cell_Thickness: 36.4, Cell_Width: 174.4, Cell_Height: 175.3, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.35944315, PowerEnergyDensity: 163.2653061, Cycles: 4000, Price: 28.79, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CATL", CellModelNo: "CATL-100", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 100000, TheMaxDischargeCurrentOfTheTabs: 100, Impedance: 0.28, Weight: 1950, Cell_Thickness: 49.9, Cell_Width: 160, Cell_Height: 119, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.33680807, PowerEnergyDensity: 164.1025641, Cycles: 3500, Price: 33, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF280K", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 280000, TheMaxDischargeCurrentOfTheTabs: 280, Impedance: 0.25, Weight: 5420, Cell_Thickness: 72, Cell_Width: 173.7, Cell_Height: 207.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.345269005, PowerEnergyDensity: 165.3136531, Cycles: 6000, Price: 58, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF100L", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 100000, TheMaxDischargeCurrentOfTheTabs: 100, Impedance: 0.5, Weight: 1980, Cell_Thickness: 49.9, Cell_Width: 160, Cell_Height: 118.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.338229201, PowerEnergyDensity: 161.6161616, Cycles: 5000, Price: 25.44, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF50K", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 3, MaxContinuousChargeRate: 3, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 50000, TheMaxDischargeCurrentOfTheTabs: 150, Impedance: 0.7, Weight: 1395, Cell_Thickness: 29.3, Cell_Width: 135.3, Cell_Height: 185.3, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.217810668, PowerEnergyDensity: 114.6953405, Cycles: 7000, Price: 19.19, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Gotion", CellModelNo: "LFP-102", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 102000, TheMaxDischargeCurrentOfTheTabs: 102, Impedance: 0.4, Weight: 1926, Cell_Thickness: 49.9, Cell_Width: 160, Cell_Height: 118.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.344993785, PowerEnergyDensity: 169.470405, Cycles: 3000, Price: 30, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Gotion", CellModelNo: "LFP-52", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 52000, TheMaxDischargeCurrentOfTheTabs: 52, Impedance: 0.8, Weight: 966, Cell_Thickness: 28.2, Cell_Width: 148, Cell_Height: 118.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.336452801, PowerEnergyDensity: 172.2567288, Cycles: 2000, Price: 19.19, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Gotion", CellModelNo: "LFP-30", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1.5, MaxContinuousChargeRate: 2, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 30000, TheMaxDischargeCurrentOfTheTabs: 45, Impedance: 1.5, Weight: 640, Cell_Thickness: 20.5, Cell_Width: 100, Cell_Height: 144, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.325203252, PowerEnergyDensity: 150, Cycles: 3000, Price: 9.12, OriginCountry: "China", Connection: "Solder" },
  { Brand: "LiShen", CellModelNo: "LP33-125", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 125000, TheMaxDischargeCurrentOfTheTabs: 125, Impedance: 0.5, Weight: 2461, Cell_Thickness: 33.2, Cell_Width: 200.3, Cell_Height: 173.2, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.347290634, PowerEnergyDensity: 162.5355547, Cycles: 6000, Price: 48, OriginCountry: "China", Connection: "Solder" },
  { Brand: "REPT", CellModelNo: "RP-100", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 2, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 100000, TheMaxDischargeCurrentOfTheTabs: 200, Impedance: 0.6, Weight: 2000, Cell_Thickness: 49.9, Cell_Width: 160.4, Cell_Height: 118.6, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.337101263, PowerEnergyDensity: 160, Cycles: 5000, Price: 28.8, OriginCountry: "China", Connection: "Solder" },
  { Brand: "REPT", CellModelNo: "RP-50", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 2, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 50000, TheMaxDischargeCurrentOfTheTabs: 100, Impedance: 0.6, Weight: 1180, Cell_Thickness: 39.7, Cell_Width: 148.4, Cell_Height: 105.1, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.258400208, PowerEnergyDensity: 135.5932203, Cycles: 6000, Price: 19.19, OriginCountry: "China", Connection: "Solder" },
  { Brand: "CALB", CellModelNo: "L221N147A", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.76, ChargeVoltage: 4.35, Capacity: 147000, TheMaxDischargeCurrentOfTheTabs: 147, Impedance: 0.4, Weight: 2340, Cell_Thickness: 44.46, Cell_Width: 220.8, Cell_Height: 105.2, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.535205925, PowerEnergyDensity: 236.2051282, Cycles: 2000, Price: 96, OriginCountry: "China", Connection: "Solder" },
  { Brand: "EVE", CellModelNo: "LF100MA", Composition: "Unknown", Cell_Stack: "C", MaxContinuousDischargeRate: 0.5, MaxContinuousChargeRate: 0.5, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 101000, TheMaxDischargeCurrentOfTheTabs: 50.5, Impedance: 0.5, Weight: 1920, Cell_Thickness: 50.1, Cell_Width: 160, Cell_Height: 118.5, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.340247774, PowerEnergyDensity: 168.3333333, Cycles: 2000, Price: 33.6, OriginCountry: "China", Connection: "Solder" },
  { Brand: "REPT", CellModelNo: "CB29148112EA", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 2, MaxContinuousChargeRate: 1, NominalVoltage: 3.22, ChargeVoltage: 3.65, Capacity: 48000, TheMaxDischargeCurrentOfTheTabs: 96, Impedance: 0.5, Weight: 1082, Cell_Thickness: 29.72, Cell_Width: 148.66, Cell_Height: 114.61, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.305233125, PowerEnergyDensity: 142.8465804, Cycles: 3000, Price: 18, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Gotion", CellModelNo: "IFP28148115A-40Ah", Composition: "LFP", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 1, NominalVoltage: 3.2, ChargeVoltage: 3.65, Capacity: 40000, TheMaxDischargeCurrentOfTheTabs: 40, Impedance: 0.65, Weight: 935, Cell_Thickness: 28, Cell_Width: 148, Cell_Height: 115, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.268591573, PowerEnergyDensity: 136.8983957, Cycles: 3000, Price: 16, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Svolt", CellModelNo: "CE52E8A0A", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 1, MaxContinuousChargeRate: 0.5, NominalVoltage: 3.64, ChargeVoltage: 4.2, Capacity: 126000, TheMaxDischargeCurrentOfTheTabs: 126, Impedance: 0.4, Weight: 1809, Cell_Thickness: 52.3, Cell_Width: 147, Cell_Height: 105.3, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.566532115, PowerEnergyDensity: 253.5323383, Cycles: 2000, Price: 52, OriginCountry: "China", Connection: "Solder" },
  { Brand: "Svolt", CellModelNo: "CE26E891A-51Ah", Composition: "NMC", Cell_Stack: "C", MaxContinuousDischargeRate: 0.51, MaxContinuousChargeRate: 0.51, NominalVoltage: 3.65, ChargeVoltage: 4.2, Capacity: 51000, TheMaxDischargeCurrentOfTheTabs: 26.01, Impedance: 0.6, Weight: 855, Cell_Thickness: 26.72, Cell_Width: 91.4, Cell_Height: 96.3, TabsThickness: 0.15, TabsWidth: 6, TabsLength: 2, DistanceBetweenTwoTabs: 0, VolumeEnergyDensity: 0.791505804, PowerEnergyDensity: 217.7192982, Cycles: 2000, Price: 22, OriginCountry: "China", Connection: "Solder" },
];

// --- LOGIC FUNCTIONS ---

function selectComponent<T extends { vdc_max: number; a_max: number; link: string }>(
  components: T[],
  voltageRequired: number,
  currentRequired: number
): (T & { price: number }) | null {
  const suitable = components.filter(
    (c) => c.vdc_max >= voltageRequired && c.a_max >= currentRequired
  );

  if (suitable.length === 0) return null;

  return suitable.reduce((cheapest, current) => {
    const currentPrice = 'price' in current ? (current as any).price : 0;
    const cheapestPrice = 'price' in cheapest ? (cheapest as any).price : 0;
    return currentPrice < cheapestPrice ? current : cheapest;
  }) as (T & { price: number });
}

function selectBMS(
  bmsOptions: ComponentDB['bms'],
  seriesCells: number,
  maxCurrent: number
): Bms | null {
  const suitable = bmsOptions.filter(
    (bms) => bms.max_cells >= seriesCells && bms.a_max >= maxCurrent
  );

  if (suitable.length === 0) return null;

  return suitable.reduce((cheapest, current) =>
    current.master_price < cheapest.master_price ? current : cheapest
  );
}

function selectCable(
  cables: ComponentDB['cables'],
  iPeak: number,
  vMax: number,
  tAmb: number
): { model: string; section: number; price: number; link: string } | null {
  const T_max_cable = 120;
  const rho_e = 1.68e-8;
  const cable_length = 1;
  const R_th = 0.5;

  const delta_T = T_max_cable - tAmb;
  const A_m2 = (Math.pow(iPeak, 2) * rho_e * Math.pow(cable_length, 2) * R_th) / delta_T;
  const A_mm2_calc = A_m2 * 1e6;

  const suitable = cables.filter(
    (cable) => cable.section >= A_mm2_calc && cable.vdc_max >= vMax && cable.a_max >= iPeak
  );

  if (suitable.length === 0) return null;

  const selected = suitable.reduce((best, current) =>
    current.section < best.section ? current : best
  );

  return {
    model: `${selected.brand} ${selected.model}`,
    section: selected.section,
    price: selected.price * cable_length * 2,
    link: selected.link,
  };
}

function configGeometryValidation(
  cell: CellData,
  series: number,
  parallel: number,
  maxX: number,
  maxY: number
): boolean {
  const eCellSpacing = cell.Cell_Thickness + 0.2;
  const lCellSpacing = cell.Cell_Width + 0.2;
  const nCells = parallel * series;

  const orientations = [
    [eCellSpacing, lCellSpacing],
    [lCellSpacing, eCellSpacing]
  ];

  for (const [e, l] of orientations) {
    const maxConfigX = Math.floor(maxX / e);
    const maxConfigY = Math.floor(maxY / l);
    
    let found = false;
    for (let nx = 1; nx <= maxConfigX; nx++) {
      for (let ny = 1; ny <= maxConfigY; ny++) {
        if (nx * ny == nCells) {
          const totalWidth = nx * e;
          const totalLength = ny * l;
          if (totalWidth <= maxX && totalLength <= maxY) {
            found = true;
            return true;
          }
        }
      }
    }
  }
  return false;
}

function computeCellConfigurations(
  requirements: Requirements,
  cellCatalogue: CellData[],
  componentDB: ComponentDB
): { configs: Configuration[] } {
  const configs: Configuration[] = [];

  for (const cell of cellCatalogue) {
    const weight = cell.Weight * 1e-3;
    const impedance = cell.Impedance * 1e-3;
    const capacity = cell.Capacity * 1e-3;

    const requiredHeight = cell.Cell_Height + 30;
    if (requiredHeight > requirements.max_z) continue;

    const minSeriesFromVoltage = Math.ceil(requirements.Min_Max_Voltage / cell.NominalVoltage);
    const maxSeriesFromVoltage = Math.floor(requirements.Max_Max_Voltage / cell.NominalVoltage);

    if (minSeriesFromVoltage > maxSeriesFromVoltage) continue;

    for (let series = minSeriesFromVoltage; series <= maxSeriesFromVoltage; series++) {
      const batteryVoltage = series * cell.NominalVoltage;
      const maxVoltage = series * cell.ChargeVoltage;

      const cellEnergy = capacity * cell.NominalVoltage;
      const minParallelForEnergy = Math.ceil(requirements.Min_Rated_Energy / (series * cellEnergy));

      const cellcontCurrent = capacity * cell.MaxContinuousDischargeRate;
      const cellcontPower = cellcontCurrent * cell.NominalVoltage;
      const minParallelForPower = Math.ceil(requirements.Continuous_Power / (series * cellcontPower));

      for (let parallel = Math.max(minParallelForEnergy, minParallelForPower, 1); parallel <= 5; parallel++) {
        const totalCells = series * parallel;
        const batteryCapacity = capacity * parallel;
        const batteryEnergy = batteryVoltage * batteryCapacity;
        const batteryWeight = weight * totalCells;
        const batteryImpedance = (impedance * series) / parallel;
        const nominalCurrent = capacity * cell.MaxContinuousDischargeRate;
        const continuousPower = batteryVoltage * nominalCurrent * parallel;
        const peakCurrent = cellcontCurrent * parallel * 5;
        const peakPower = batteryVoltage * peakCurrent;
        const cellsPrice = cell.Price * totalCells;

        if (!configGeometryValidation(cell, series, parallel, requirements.max_x, requirements.max_y)) continue;
        if (batteryWeight > requirements.Battery_max_weight) continue;
        if (continuousPower < requirements.Continuous_Power) continue;
        if (batteryEnergy < requirements.Min_Rated_Energy) continue;

        const fuseRating = Math.ceil(1.25 * peakCurrent);
        const fuse = selectComponent(componentDB.fuses, maxVoltage, fuseRating);

        const relayCurrentRating = Math.ceil(1.5 * peakCurrent);
        const relayVoltageRating = Math.ceil(1.25 * maxVoltage);
        const relay = selectComponent(componentDB.relays, relayVoltageRating, relayCurrentRating);

        const cable = selectCable(componentDB.cables, peakCurrent, maxVoltage, requirements.T_amb);
        const bms = selectBMS(componentDB.bms, series, peakCurrent);
        const shunt = selectComponent(componentDB.shunts, maxVoltage, peakCurrent);

        let totalPrice = cellsPrice;
        if (fuse) totalPrice += fuse.price;
        if (relay) totalPrice += relay.price;
        if (cable) totalPrice += cable.price;
        if (bms) totalPrice += bms.master_price;
        if (shunt) totalPrice += shunt.price;

        if (totalPrice > requirements.Max_Price) continue;

        configs.push({
          cell: cell,
          series_cells: series,
          parallel_cells: parallel,
          battery_voltage: Math.round(batteryVoltage * 10) / 10,
          battery_capacity: Math.round(batteryCapacity * 10) / 10,
          battery_energy: Math.round(batteryEnergy),
          battery_weight: Math.round(batteryWeight * 10) / 10,
          battery_impedance: Math.round(batteryImpedance * 1000) / 1000,
          continuous_power: Math.round(continuousPower),
          peak_power: Math.round(peakPower),
          cell_price: Math.round(cellsPrice * 100) / 100,
          fuse: fuse,
          relay: relay,
          cable: cable,
          bms: bms,
          shunt: shunt,
          total_price: Math.round(totalPrice * 100) / 100,
          dimensions: {
            length: Math.round((cell.Cell_Width + 0.2) * Math.ceil(Math.sqrt(totalCells)) * 10) / 10,
            width: Math.round((cell.Cell_Thickness + 0.2) * Math.ceil(Math.sqrt(totalCells)) * 10) / 10,
            height: Math.round(cell.Cell_Height * 10) / 10,
          },
          affiliate_link: "",
        });
      }
    }
  }

  return { configs };
}

// --- MAIN EXPORT ---

export function calculateBatteryDesign(inputData: any) {
  const requirements: Requirements = {
    Min_Max_Voltage: parseFloat(inputData.min_voltage || '80'),
    Max_Max_Voltage: parseFloat(inputData.max_voltage || '90'),
    Min_Rated_Energy: parseFloat(inputData.min_energy || '3000'),
    Continuous_Power: parseFloat(inputData.min_continuous_power || '3000'),
    Battery_max_weight: parseFloat(inputData.max_weight || '65'),
    Max_Price: parseFloat(inputData.max_price || '5000'),
    max_x: parseFloat(inputData.max_width || '900'),
    max_y: parseFloat(inputData.max_length || '340'),
    max_z: parseFloat(inputData.max_height || '250'),
    T_amb: parseFloat(inputData.ambient_temp || '35'),
  };

  const { configs } = computeCellConfigurations(requirements, CELL_CATALOGUE, COMPONENT_DB);

  // Sorting logic duplicated from backend
  const sortedConfigurations = configs
    .sort((a, b) => (b.battery_energy / b.total_price) - (a.battery_energy / a.total_price));

  return {
    results: sortedConfigurations.slice(0, 30),
    plotResults: sortedConfigurations.slice(0, 100),
    total: configs.length,
  };
}
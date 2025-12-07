import math
from models import CellData, Fuse, Relay, Cable, Bms, Shunt, Configuration, Dimensions

# --- DATA (Copiado do teu ficheiro e adaptado para Dicts Python) ---

CELL_CATALOGUE_DATA = [
    {"Brand": "Gotion", "CellModelNo": "IFP20100140A-30Ah", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 30000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 1.5, "Weight": 615,
        "Cell_Thickness": 20, "Cell_Width": 100, "Cell_Height": 140, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.342857143, "PowerEnergyDensity": 156.097561, "Cycles": 3000, "Price": 12, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Poweroad", "CellModelNo": "L148N50B", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1.2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.7, "ChargeVoltage": 4.3, "Capacity": 50000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 1.11, "Weight": 860,
        "Cell_Thickness": 26.66, "Cell_Width": 148.2, "Cell_Height": 101.9, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.459503894, "PowerEnergyDensity": 215.1162791, "Cycles": 2000, "Price": 38.38, "OriginCountry": "China", "Connection": "L"},
    {"Brand": "", "CellModelNo": "ITPE60", "Composition": "Unknown", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1.2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.7, "ChargeVoltage": 4.3, "Capacity": 60000, "TheMaxDischargeCurrentOfTheTabs": 72, "Impedance": 1.11, "Weight": 1090,
        "Cell_Thickness": 29, "Cell_Width": 149, "Cell_Height": 120, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.428141634, "PowerEnergyDensity": 203.6697248, "Cycles": 2000, "Price": 18, "OriginCountry": "China", "Connection": "L"},
    {"Brand": "Samsung", "CellModelNo": "SDI94 Li Ion 3.7V 94AH NMC", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1.6, "MaxContinuousChargeRate": 0.765, "NominalVoltage": 3.68, "ChargeVoltage": 4.15, "Capacity": 94000, "TheMaxDischargeCurrentOfTheTabs": 150.4, "Impedance": 0.75, "Weight": 2100,
        "Cell_Thickness": 45, "Cell_Width": 173, "Cell_Height": 133, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.334091491, "PowerEnergyDensity": 164.7238095, "Cycles": 3200, "Price": 82.14, "OriginCountry": "South Korea", "Connection": "Solder"},
    {"Brand": "", "CellModelNo": "CS0600R0002a", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.7, "ChargeVoltage": 4.2, "Capacity": 60000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 1.11, "Weight": 1850,
        "Cell_Thickness": 45, "Cell_Width": 173, "Cell_Height": 130, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.219356751, "PowerEnergyDensity": 120, "Cycles": 2000, "Price": 18, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CATL", "CellModelNo": "ND-3.7V 60Ah", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.7, "ChargeVoltage": 4.3, "Capacity": 60000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 0.5, "Weight": 967,
        "Cell_Thickness": 29, "Cell_Width": 148, "Cell_Height": 104, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.49734748, "PowerEnergyDensity": 229.5760083, "Cycles": 2000, "Price": 30, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF105", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 0.5, "MaxContinuousChargeRate": 0.5, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 105000, "TheMaxDischargeCurrentOfTheTabs": 52.5, "Impedance": 0.32, "Weight": 1980,
        "Cell_Thickness": 36.35, "Cell_Width": 130.3, "Cell_Height": 200.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.35381486, "PowerEnergyDensity": 169.6969697, "Cycles": 2000, "Price": 28, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF105-73103 (Rep)", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 105000, "TheMaxDischargeCurrentOfTheTabs": 105, "Impedance": 0.5, "Weight": 1980,
     "Cell_Thickness": 36.7, "Cell_Width": 130.3, "Cell_Height": 200.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.350440604, "PowerEnergyDensity": 169.6969697, "Cycles": 3500, "Price": 25, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF22k", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.22, "ChargeVoltage": 3.7, "Capacity": 22000, "TheMaxDischargeCurrentOfTheTabs": 22, "Impedance": 0.5, "Weight": 618,
        "Cell_Thickness": 17.7, "Cell_Width": 148.7, "Cell_Height": 131.8, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.204210894, "PowerEnergyDensity": 114.6278317, "Cycles": 2000, "Price": 14, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CALB", "CellModelNo": "L221N113B", "Composition": "Unknown", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 4.35, "Capacity": 113500, "TheMaxDischargeCurrentOfTheTabs": 113.5, "Impedance": 1.11, "Weight": 1795,
        "Cell_Thickness": 33.36, "Cell_Width": 220.8, "Cell_Height": 105.88, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.465700599, "PowerEnergyDensity": 202.3398329, "Cycles": 1500, "Price": 45, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CATL", "CellModelNo": "LN52148103", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.65, "ChargeVoltage": 4.2, "Capacity": 114000, "TheMaxDischargeCurrentOfTheTabs": 114, "Impedance": 1, "Weight": 1800,
        "Cell_Thickness": 52, "Cell_Width": 148, "Cell_Height": 103, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.524922794, "PowerEnergyDensity": 231.1666667, "Cycles": 2000, "Price": 48, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "ANC", "CellModelNo": "ANC-100", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 100000, "TheMaxDischargeCurrentOfTheTabs": 100, "Impedance": 0.4, "Weight": 2000,
        "Cell_Thickness": 48.8, "Cell_Width": 173.9, "Cell_Height": 121.1, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.311376929, "PowerEnergyDensity": 160, "Cycles": 4000, "Price": 55, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "BYD", "CellModelNo": "C47FCSA-102", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2.5, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 102000, "TheMaxDischargeCurrentOfTheTabs": 255, "Impedance": 0.35, "Weight": 1990,
        "Cell_Thickness": 49.9, "Cell_Width": 160, "Cell_Height": 118.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.344993785, "PowerEnergyDensity": 164.0201005, "Cycles": 6000, "Price": 81.57, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CALB", "CellModelNo": "CA-125", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 125000, "TheMaxDischargeCurrentOfTheTabs": 125, "Impedance": 0.9, "Weight": 2450,
        "Cell_Thickness": 36.4, "Cell_Width": 174.4, "Cell_Height": 175.3, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.35944315, "PowerEnergyDensity": 163.2653061, "Cycles": 4000, "Price": 28.79, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CATL", "CellModelNo": "CATL-100", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 100000, "TheMaxDischargeCurrentOfTheTabs": 100, "Impedance": 0.28, "Weight": 1950,
        "Cell_Thickness": 49.9, "Cell_Width": 160, "Cell_Height": 119, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.33680807, "PowerEnergyDensity": 164.1025641, "Cycles": 3500, "Price": 33, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF280K", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 280000, "TheMaxDischargeCurrentOfTheTabs": 280, "Impedance": 0.25, "Weight": 5420,
        "Cell_Thickness": 72, "Cell_Width": 173.7, "Cell_Height": 207.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.345269005, "PowerEnergyDensity": 165.3136531, "Cycles": 6000, "Price": 58, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF100L", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 100000, "TheMaxDischargeCurrentOfTheTabs": 100, "Impedance": 0.5, "Weight": 1980,
        "Cell_Thickness": 49.9, "Cell_Width": 160, "Cell_Height": 118.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.338229201, "PowerEnergyDensity": 161.6161616, "Cycles": 5000, "Price": 25.44, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF50K", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 3, "MaxContinuousChargeRate": 3, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 50000, "TheMaxDischargeCurrentOfTheTabs": 150, "Impedance": 0.7, "Weight": 1395,
        "Cell_Thickness": 29.3, "Cell_Width": 135.3, "Cell_Height": 185.3, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.217810668, "PowerEnergyDensity": 114.6953405, "Cycles": 7000, "Price": 19.19, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Gotion", "CellModelNo": "LFP-102", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 102000, "TheMaxDischargeCurrentOfTheTabs": 102, "Impedance": 0.4, "Weight": 1926,
        "Cell_Thickness": 49.9, "Cell_Width": 160, "Cell_Height": 118.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.344993785, "PowerEnergyDensity": 169.470405, "Cycles": 3000, "Price": 30, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Gotion", "CellModelNo": "LFP-52", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 52000, "TheMaxDischargeCurrentOfTheTabs": 52, "Impedance": 0.8, "Weight": 966,
        "Cell_Thickness": 28.2, "Cell_Width": 148, "Cell_Height": 118.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.336452801, "PowerEnergyDensity": 172.2567288, "Cycles": 2000, "Price": 19.19, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Gotion", "CellModelNo": "LFP-30", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1.5, "MaxContinuousChargeRate": 2, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 30000, "TheMaxDischargeCurrentOfTheTabs": 45, "Impedance": 1.5, "Weight": 640,
        "Cell_Thickness": 20.5, "Cell_Width": 100, "Cell_Height": 144, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.325203252, "PowerEnergyDensity": 150, "Cycles": 3000, "Price": 9.12, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "LiShen", "CellModelNo": "LP33-125", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 125000, "TheMaxDischargeCurrentOfTheTabs": 125, "Impedance": 0.5, "Weight": 2461,
        "Cell_Thickness": 33.2, "Cell_Width": 200.3, "Cell_Height": 173.2, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.347290634, "PowerEnergyDensity": 162.5355547, "Cycles": 6000, "Price": 48, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "REPT", "CellModelNo": "RP-100", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 100000, "TheMaxDischargeCurrentOfTheTabs": 200, "Impedance": 0.6, "Weight": 2000,
        "Cell_Thickness": 49.9, "Cell_Width": 160.4, "Cell_Height": 118.6, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.337101263, "PowerEnergyDensity": 160, "Cycles": 5000, "Price": 28.8, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "REPT", "CellModelNo": "RP-50", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 50000, "TheMaxDischargeCurrentOfTheTabs": 100, "Impedance": 0.6, "Weight": 1180,
        "Cell_Thickness": 39.7, "Cell_Width": 148.4, "Cell_Height": 105.1, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.258400208, "PowerEnergyDensity": 135.5932203, "Cycles": 6000, "Price": 19.19, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "CALB", "CellModelNo": "L221N147A", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.76, "ChargeVoltage": 4.35, "Capacity": 147000, "TheMaxDischargeCurrentOfTheTabs": 147, "Impedance": 0.4, "Weight": 2340,
        "Cell_Thickness": 44.46, "Cell_Width": 220.8, "Cell_Height": 105.2, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.535205925, "PowerEnergyDensity": 236.2051282, "Cycles": 2000, "Price": 96, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "EVE", "CellModelNo": "LF100MA", "Composition": "Unknown", "Cell_Stack": "C", "MaxContinuousDischargeRate": 0.5, "MaxContinuousChargeRate": 0.5, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 101000, "TheMaxDischargeCurrentOfTheTabs": 50.5, "Impedance": 0.5, "Weight": 1920,
        "Cell_Thickness": 50.1, "Cell_Width": 160, "Cell_Height": 118.5, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.340247774, "PowerEnergyDensity": 168.3333333, "Cycles": 2000, "Price": 33.6, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "REPT", "CellModelNo": "CB29148112EA", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.22, "ChargeVoltage": 3.65, "Capacity": 48000, "TheMaxDischargeCurrentOfTheTabs": 96, "Impedance": 0.5, "Weight": 1082,
        "Cell_Thickness": 29.72, "Cell_Width": 148.66, "Cell_Height": 114.61, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.305233125, "PowerEnergyDensity": 142.8465804, "Cycles": 3000, "Price": 18, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Gotion", "CellModelNo": "IFP28148115A-40Ah", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 40000, "TheMaxDischargeCurrentOfTheTabs": 40, "Impedance": 0.65, "Weight": 935,
        "Cell_Thickness": 28, "Cell_Width": 148, "Cell_Height": 115, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.268591573, "PowerEnergyDensity": 136.8983957, "Cycles": 3000, "Price": 16, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Svolt", "CellModelNo": "CE52E8A0A", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1, "MaxContinuousChargeRate": 0.5, "NominalVoltage": 3.64, "ChargeVoltage": 4.2, "Capacity": 126000, "TheMaxDischargeCurrentOfTheTabs": 126, "Impedance": 0.4, "Weight": 1809,
        "Cell_Thickness": 52.3, "Cell_Width": 147, "Cell_Height": 105.3, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.566532115, "PowerEnergyDensity": 253.5323383, "Cycles": 2000, "Price": 52, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Svolt", "CellModelNo": "CE26E891A-51Ah", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 0.51, "MaxContinuousChargeRate": 0.51, "NominalVoltage": 3.65, "ChargeVoltage": 4.2, "Capacity": 51000, "TheMaxDischargeCurrentOfTheTabs": 26.01, "Impedance": 0.6, "Weight": 855,
        "Cell_Thickness": 26.72, "Cell_Width": 91.4, "Cell_Height": 96.3, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.791505804, "PowerEnergyDensity": 217.7192982, "Cycles": 2000, "Price": 22, "OriginCountry": "China", "Connection": "Solder"},
]

# Converter para objetos Pydantic
CELL_CATALOGUE = [CellData(**c) for c in CELL_CATALOGUE_DATA]

COMPONENT_DB = {
    "fuses": [
        {"brand": "Littelfuse Inc", "model": "0999030.ZXN", "vdc_max": 58,
            "a_max": 30, "temp_min": -40, "temp_max": 125, "price": 3.32, "link": ""},
        {"brand": "ESKA", "model": "340027-80V", "vdc_max": 80, "a_max": 30,
            "temp_min": -40, "temp_max": 125, "price": 3.21, "link": ""},
        {"brand": "Littelfuse Inc", "model": "0HEV030.ZXISO", "vdc_max": 450,
            "a_max": 30, "temp_min": -40, "temp_max": 125, "price": 24.35, "link": ""},
        {"brand": "HELLA", "model": "8JS 742 901-051", "vdc_max": 150, "a_max": 100,
            "temp_min": -40, "temp_max": 125, "price": 5.33, "link": ""},
        {"brand": "Littelfuse Inc", "model": "142.5631.6102", "vdc_max": 58,
            "a_max": 100, "temp_min": -40, "temp_max": 125, "price": 3.69, "link": ""},
        {"brand": "Littelfuse Inc", "model": "153.5631.6151", "vdc_max": 32,
            "a_max": 150, "temp_min": -40, "temp_max": 125, "price": 3.94, "link": ""},
        {"brand": "Cfriend", "model": "EVAE-300A", "vdc_max": 125, "a_max": 300,
            "temp_min": -40, "temp_max": 125, "price": 36.6, "link": ""},
        {"brand": "Cfriend", "model": "EVAE-350A", "vdc_max": 125, "a_max": 350,
            "temp_min": -40, "temp_max": 125, "price": 38, "link": ""},
        {"brand": "Cfriend", "model": "EVAE-400A", "vdc_max": 125, "a_max": 400,
            "temp_min": -40, "temp_max": 125, "price": 40, "link": ""},
        {"brand": "Cfriend", "model": "Example", "vdc_max": 125, "a_max": 1000,
            "temp_min": -40, "temp_max": 125, "price": 40, "link": "www.bestlink.com"},
    ],
    "relays": [
        {"brand": "OZSSLJJ", "model": "RL/180", "vdc_max": 72, "a_max": 100,
            "temp_min": -40, "temp_max": 125, "price": 47, "link": ""},
        {"brand": "Sensata", "model": "D1D100", "vdc_max": 100, "a_max": 100,
            "temp_min": -40, "temp_max": 125, "price": 159, "link": ""},
        {"brand": "Innuovo", "model": "INVE01-200", "vdc_max": 450, "a_max": 200,
            "temp_min": -40, "temp_max": 125, "price": 36.36, "link": ""},
        {"brand": "Innuovo", "model": "Placeholder", "vdc_max": 450, "a_max": 2000,
            "temp_min": -40, "temp_max": 125, "price": 36.36, "link": ""},
    ],
    "cables": [
        {"brand": "feked", "model": "Single Core Electric Wire Cable", "section": 2,
            "vdc_max": 12, "a_max": 17.5, "temp_min": -40, "temp_max": 120, "price": 1, "link": ""},
        {"brand": "TLC", "model": "6491X 1.5mm²", "section": 1.5, "vdc_max": 15,
            "a_max": 17, "temp_min": -40, "temp_max": 120, "price": 0.19, "link": ""},
        {"brand": "TLC", "model": "6491X 2.5mm²", "section": 2.5, "vdc_max": 24,
            "a_max": 24, "temp_min": -40, "temp_max": 120, "price": 0.28, "link": ""},
        {"brand": "TLC", "model": "6491X 4mm²", "section": 4, "vdc_max": 32,
            "a_max": 32, "temp_min": -40, "temp_max": 120, "price": 0.44, "link": ""},
        {"brand": "Solar Shop", "model": "SCBAC00662", "section": 6, "vdc_max": 120,
            "a_max": 62, "temp_min": -40, "temp_max": 120, "price": 1.87, "link": ""},
        {"brand": "MidSummer", "model": "Solar PV Cable", "section": 10, "vdc_max": 1000,
            "a_max": 80, "temp_min": -40, "temp_max": 120, "price": 2.18, "link": ""},
        {"brand": "Split Charge", "model": "Hi-Flex Battery Cable 16mm²", "section": 16,
            "vdc_max": 1000, "a_max": 110, "temp_min": -40, "temp_max": 120, "price": 3.3, "link": ""},
        {"brand": "SplitCharge", "model": "Hi-Flex Battery Cable 20mm²", "section": 20,
            "vdc_max": 1000, "a_max": 135, "temp_min": -40, "temp_max": 120, "price": 3.93, "link": ""},
        {"brand": "SplitCharge", "model": "Placeholder", "section": 100, "vdc_max": 1000,
            "a_max": 1305, "temp_min": -40, "temp_max": 120, "price": 3.93, "link": "www.link.com"},
    ],
    "bms": [
        {"brand": "Sensata", "model": "c-BMS", "max_cells": 24, "vdc_min": 11, "vdc_max": 120, "a_max": 2000,
            "temp_min": -40, "temp_max": 125, "master_price": 800, "slave_price": 0, "link": ""},
        {"brand": "Sensata", "model": "n-BMS", "max_cells": 384, "vdc_min": 12, "vdc_max": 1000, "a_max": 5000,
            "temp_min": -40, "temp_max": 125, "master_price": 1000, "slave_price": 200, "link": ""},
    ],
    "shunts": [
        {"brand": "Isabellenhuette", "model": "IVT-S-100", "vdc_max": 1000,
            "a_max": 120, "temp_min": -40, "temp_max": 105, "price": 380.7, "link": ""},
        {"brand": "Isabellenhuette", "model": "IVT-S-300", "vdc_max": 1000,
            "a_max": 320, "temp_min": -40, "temp_max": 105, "price": 378.08, "link": ""},
        {"brand": "Isabellenhuette", "model": "IVT-S-500", "vdc_max": 1000,
            "a_max": 730, "temp_min": -40, "temp_max": 105, "price": 388.04, "link": ""},
        {"brand": "Isabellenhuette", "model": "IVT-S-1000", "vdc_max": 1000,
            "a_max": 1100, "temp_min": -40, "temp_max": 105, "price": 392.02, "link": ""},
        {"brand": "Isabellenhuette", "model": "IVT-S-2500", "vdc_max": 1000,
            "a_max": 2700, "temp_min": -40, "temp_max": 105, "price": 405.88, "link": ""},
        {"brand": "Riedon", "model": "SSA-2-100A", "vdc_max": 1500, "a_max": 200,
            "temp_min": -40, "temp_max": 115, "price": 82.42, "link": ""},
        {"brand": "Riedon", "model": "SSA-2-250A", "vdc_max": 1500, "a_max": 500,
            "temp_min": -40, "temp_max": 115, "price": 85.64, "link": ""},
        {"brand": "Riedon", "model": "SSA-2-500A", "vdc_max": 1500, "a_max": 1000,
            "temp_min": -40, "temp_max": 115, "price": 89.34, "link": ""},
        {"brand": "Riedon", "model": "SSA-2-1000A", "vdc_max": 1500, "a_max": 2000,
            "temp_min": -40, "temp_max": 115, "price": 93.2, "link": ""},
    ],
}

# --- LOGIC FUNCTIONS (Translation from TypeScript) ---


def select_component(components, voltage_req, current_req):
    suitable = [c for c in components if c['vdc_max']
                >= voltage_req and c['a_max'] >= current_req]
    if not suitable:
        return None
    # Retorna o mais barato (em TS: reduce)
    best = min(suitable, key=lambda x: x.get('price', 0))
    return best  # Retorna o dict, Pydantic faz o resto


def select_bms(bms_list, series_cells, max_current):
    suitable = [b for b in bms_list if b['max_cells']
                >= series_cells and b['a_max'] >= max_current]
    if not suitable:
        return None
    best = min(suitable, key=lambda x: x.get('master_price', 0))
    # BMS em TS tinha estrutura diferente no DB vs Configuration, adaptamos para o modelo Bms
    return best


def select_cable(cables, i_peak, v_max, t_amb):
    T_max_cable = 120
    rho_e = 1.68e-8
    cable_length = 1
    R_th = 0.5

    delta_T = T_max_cable - t_amb
    if delta_T <= 0:
        delta_T = 1

    A_m2 = (pow(i_peak, 2) * rho_e * pow(cable_length, 2) * R_th) / delta_T
    A_mm2_calc = A_m2 * 1e6

    suitable = [c for c in cables if c['section'] >=
                A_mm2_calc and c['vdc_max'] >= v_max and c['a_max'] >= i_peak]
    if not suitable:
        return None

    best = min(suitable, key=lambda x: x['section'])

    return {
        "brand": best['brand'],
        "model": best['model'] + " " + best.get('model', ''),
        "section": best['section'],
        "vdc_max": best['vdc_max'],
        "a_max": best['a_max'],
        "temp_min": best['temp_min'],
        "temp_max": best['temp_max'],
        "price": best['price'] * cable_length * 2,
        "link": best['link']
    }


def config_geometry_validation(cell: CellData, series, parallel, max_x, max_y):
    e_cell_spacing = cell.Cell_Thickness + 0.2
    l_cell_spacing = cell.Cell_Width + 0.2
    n_cells = parallel * series

    orientations = [
        (e_cell_spacing, l_cell_spacing),
        (l_cell_spacing, e_cell_spacing)
    ]

    for e, l in orientations:
        max_config_x = math.floor(max_x / e)
        max_config_y = math.floor(max_y / l)

        for nx in range(1, max_config_x + 1):
            for ny in range(1, max_config_y + 1):
                if nx * ny == n_cells:
                    total_width = nx * e
                    total_length = ny * l
                    if total_width <= max_x and total_length <= max_y:
                        return True
    return False


def compute_cell_configurations(req, cell_catalogue, component_db):
    configs = []

    # Stats counters
    total_attempts = 0
    failed_height = 0
    failed_geometry = 0
    failed_weight = 0
    failed_power = 0
    failed_energy = 0
    failed_fuse = 0
    failed_relay = 0
    failed_cable = 0
    failed_bms = 0
    failed_shunt = 0
    failed_price = 0

    print(
        f"Starting configuration calculation with {len(cell_catalogue)} cells")

    for cell in cell_catalogue:
        weight = cell.Weight * 1e-3
        impedance = cell.Impedance * 1e-3
        capacity = cell.Capacity * 1e-3

        required_height = cell.Cell_Height + 30
        if required_height > req.max_height:
            failed_height += 1
            continue

        min_series = math.ceil(req.min_voltage / cell.NominalVoltage)
        max_series = math.floor(req.max_voltage / cell.NominalVoltage)

        if min_series > max_series:
            continue

        for series in range(min_series, max_series + 1):
            bat_voltage = series * cell.NominalVoltage
            max_voltage = series * cell.ChargeVoltage

            cell_energy = capacity * cell.NominalVoltage

            # Avoid division by zero if cell_energy is 0 (unlikely but safe)
            min_p_energy = math.ceil(
                req.min_energy / (series * cell_energy)) if cell_energy > 0 else 1

            cell_cont_current = capacity * cell.MaxContinuousDischargeRate
            cell_cont_power = cell_cont_current * cell.NominalVoltage
            min_p_power = math.ceil(
                req.min_continuous_power / (series * cell_cont_power)) if cell_cont_power > 0 else 1

            start_p = max(min_p_energy, min_p_power, 1)

            for parallel in range(start_p, 6):  # Limit 5P matches TS loop (<= 5)
                total_attempts += 1
                total_cells = series * parallel
                bat_capacity = capacity * parallel
                bat_energy = bat_voltage * bat_capacity
                bat_weight = weight * total_cells
                bat_impedance = (impedance * series) / parallel
                nominal_current = capacity * cell.MaxContinuousDischargeRate
                continuous_power = bat_voltage * nominal_current * parallel
                peak_current = cell_cont_current * parallel * 5
                peak_power = bat_voltage * peak_current
                cells_price = cell.Price * total_cells

                # Validations
                if not config_geometry_validation(cell, series, parallel, req.max_width, req.max_length):
                    failed_geometry += 1
                    continue

                if bat_weight > req.max_weight:
                    failed_weight += 1
                    continue

                if continuous_power < req.min_continuous_power:
                    failed_power += 1
                    continue

                if bat_energy < req.min_energy:
                    failed_energy += 1
                    continue

                # Components
                fuse = select_component(
                    component_db['fuses'], max_voltage, peak_current * 1.25)
                if not fuse:
                    failed_fuse += 1

                relay = select_component(
                    component_db['relays'], max_voltage * 1.25, peak_current * 1.5)
                if not relay:
                    failed_relay += 1

                cable = select_cable(
                    component_db['cables'], peak_current, max_voltage, req.ambient_temp)
                if not cable:
                    failed_cable += 1

                bms = select_bms(component_db['bms'], series, peak_current)
                if not bms:
                    failed_bms += 1

                shunt = select_component(
                    component_db['shunts'], max_voltage, peak_current)
                if not shunt:
                    failed_shunt += 1

                # Calculate Price (Sum only existing components)
                total_price = cells_price
                if fuse:
                    total_price += fuse['price']
                if relay:
                    total_price += relay['price']
                if cable:
                    total_price += cable['price']
                if bms:
                    total_price += bms['master_price']  # BMS uses master_price
                if shunt:
                    total_price += shunt['price']

                if total_price > req.max_price:
                    failed_price += 1
                    continue

                # Adapting Component Dicts to Pydantic Models
                fuse_obj = Fuse(**fuse) if fuse else None
                relay_obj = Relay(**relay) if relay else None
                # Cable was constructed manually in select_cable, matches model
                cable_obj = Cable(**cable) if cable else None
                # BMS key matching
                bms_obj = None
                if bms:
                    bms_obj = Bms(
                        brand=bms['brand'],
                        model=bms['model'],
                        max_cells=bms['max_cells'],
                        vdc_min=bms['vdc_min'],
                        vdc_max=bms['vdc_max'],
                        a_max=bms['a_max'],
                        temp_min=bms['temp_min'],
                        temp_max=bms['temp_max'],
                        master_price=bms['master_price'],
                        slave_price=bms['slave_price'],
                        link=bms['link']
                    )
                shunt_obj = Shunt(**shunt) if shunt else None

                config = Configuration(
                    cell=cell,
                    series_cells=series,
                    parallel_cells=parallel,
                    battery_voltage=round(bat_voltage, 1),
                    battery_capacity=round(bat_capacity, 1),
                    battery_energy=round(bat_energy),
                    battery_weight=round(bat_weight, 1),
                    battery_impedance=round(bat_impedance, 3),
                    continuous_power=round(continuous_power),
                    peak_power=round(peak_power),
                    cell_price=round(cells_price, 2),
                    fuse=fuse_obj,
                    relay=relay_obj,
                    cable=cable_obj,
                    bms=bms_obj,
                    shunt=shunt_obj,
                    total_price=round(total_price, 2),
                    dimensions=Dimensions(
                        length=round((cell.Cell_Width + 0.2) *
                                     math.ceil(math.sqrt(total_cells)), 1),
                        width=round((cell.Cell_Thickness + 0.2) *
                                    math.ceil(math.sqrt(total_cells)), 1),
                        height=round(cell.Cell_Height, 1)
                    ),
                    affiliate_link=""
                )
                configs.append(config)

    # Sorting logic matches TS: (Energy / Price) descending
    configs.sort(key=lambda x: x.battery_energy /
                 x.total_price if x.total_price > 0 else 0, reverse=True)

    stats = {
        "totalAttempts": total_attempts,
        "failedHeight": failed_height,
        "failedGeometry": failed_geometry,
        "failedWeight": failed_weight,
        "failedPower": failed_power,
        "failedEnergy": failed_energy,
        "failedFuse": failed_fuse,
        "failedRelay": failed_relay,
        "failedCable": failed_cable,
        "failedBMS": failed_bms,
        "failedShunt": failed_shunt,
        "failedPrice": failed_price,
        "validConfigurations": len(configs)
    }

    return configs, stats

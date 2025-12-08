// src/lib/presets.ts

// Definimos o tipo para garantir que não erras ao adicionar novos
export interface PresetValues {
    minVoltage: string;
    maxVoltage: string;
    minPower: string;
    minEnergy: string;
    maxWeight?: string; // Opcional
}

export interface UseCasePreset {
    label: string;
    values: PresetValues | null;
}

export const USE_CASES: Record<string, UseCasePreset> = {
    custom: {
        label: "Custom / Manual",
        values: null
    },

    // 🚲 E-BIKES
    ebike_36v: {
        label: "E-Bike (36V Standard)",
        values: { minVoltage: "28", maxVoltage: "44", minPower: "250", minEnergy: "360", maxWeight: "4" }
    },
    ebike_48v: {
        label: "E-Bike (48V High Power)",
        values: { minVoltage: "38", maxVoltage: "56", minPower: "750", minEnergy: "600", maxWeight: "5" }
    },
    ebike_52v: {
        label: "E-Bike (52V Performance)",
        values: { minVoltage: "40", maxVoltage: "60", minPower: "1000", minEnergy: "800", maxWeight: "6" }
    },
    ebike_cargo: {
        label: "Cargo E-Bike / Delivery",
        values: { minVoltage: "38", maxVoltage: "56", minPower: "1000", minEnergy: "1000", maxWeight: "12" }
    },

    // 🛴 E-SCOOTERS
    escooter_36v: {
        label: "Electric Scooter (36V Urban)",
        values: { minVoltage: "28", maxVoltage: "44", minPower: "350", minEnergy: "300", maxWeight: "4" }
    },
    escooter_48v: {
        label: "Electric Scooter (48V Performance)",
        values: { minVoltage: "38", maxVoltage: "58", minPower: "800", minEnergy: "600", maxWeight: "6" }
    },
    escooter_60v: {
        label: "Electric Scooter (60V High Performance)",
        values: { minVoltage: "46", maxVoltage: "70", minPower: "2000", minEnergy: "1200", maxWeight: "10" }
    },

    // 🛹 Electric Skateboards
    esk8_10s: {
        label: "Electric Skateboard (10S)",
        values: { minVoltage: "30", maxVoltage: "45", minPower: "1200", minEnergy: "250", maxWeight: "3" }
    },
    esk8_12s: {
        label: "Electric Skateboard (12S)",
        values: { minVoltage: "36", maxVoltage: "52", minPower: "1500", minEnergy: "300", maxWeight: "4" }
    },

    // 🚁 DRONES & FPV
    drone_4s: {
        label: "FPV Drone (4S)",
        values: { minVoltage: "10", maxVoltage: "18", minPower: "600", minEnergy: "60", maxWeight: "0.5" }
    },
    drone_6s: {
        label: "FPV Drone (6S)",
        values: { minVoltage: "15", maxVoltage: "26", minPower: "800", minEnergy: "100", maxWeight: "0.8" }
    },
    drone_cine: {
        label: "CineLifter Cinema Drone",
        values: { minVoltage: "42", maxVoltage: "52", minPower: "3000", minEnergy: "400", maxWeight: "3" }
    },

    // 🔧 Ferramentas elétricas
    powertool_18v: {
        label: "Power Tool (18V)",
        values: { minVoltage: "14", maxVoltage: "24", minPower: "350", minEnergy: "60", maxWeight: "1" }
    },
    powertool_24v: {
        label: "Power Tool (24V)",
        values: { minVoltage: "18", maxVoltage: "32", minPower: "600", minEnergy: "100", maxWeight: "1.5" }
    },

    // 🤖 ROBÓTICA
    robotics_24v: {
        label: "Robotics Platform (24V)",
        values: { minVoltage: "18", maxVoltage: "32", minPower: "500", minEnergy: "300", maxWeight: "8" }
    },
    robotics_48v: {
        label: "Robotics Heavy Duty (48V)",
        values: { minVoltage: "38", maxVoltage: "62", minPower: "1500", minEnergy: "800", maxWeight: "15" }
    },

    // 🚗 LIGHT EV (Go-kart, pequenos veículos)
    kart_48v: {
        label: "Electric Kart (48V)",
        values: { minVoltage: "38", maxVoltage: "62", minPower: "3000", minEnergy: "1500", maxWeight: "25" }
    },
    buggy_72v: {
        label: "Electric Buggy / Small EV (72V)",
        values: { minVoltage: "56", maxVoltage: "90", minPower: "5000", minEnergy: "3000", maxWeight: "40" }
    },

    // 🏠 Solar & Off-Grid
    solar_24v: {
        label: "Home Solar Storage (24V)",
        values: { minVoltage: "16", maxVoltage: "34", minPower: "1500", minEnergy: "2000", maxWeight: "60" }
    },
    solar_48v: {
        label: "Home Solar Storage (48V)",
        values: { minVoltage: "38", maxVoltage: "62", minPower: "5000", minEnergy: "5000", maxWeight: "100" }
    },
    offgrid_cabin: {
        label: "Off-Grid Cabin",
        values: { minVoltage: "38", maxVoltage: "62", minPower: "2000", minEnergy: "7000", maxWeight: "120" }
    },

    // ⚡ UPS / Backup Power
    ups_12v: {
        label: "UPS Backup (12V)",
        values: { minVoltage: "6", maxVoltage: "20", minPower: "500", minEnergy: "1000", maxWeight: "20" }
    },
    ups_48v: {
        label: "UPS Backup (48V)",
        values: { minVoltage: "38", maxVoltage: "62", minPower: "2000", minEnergy: "3000", maxWeight: "40" }
    },

    // ⛵ Barcos elétricos
    boat_24v: {
        label: "Electric Boat (24V)",
        values: { minVoltage: "18", maxVoltage: "32", minPower: "800", minEnergy: "1500", maxWeight: "25" }
    },
    boat_48v: {
        label: "Electric Boat (48V)",
        values: { minVoltage: "42", maxVoltage: "58", minPower: "2000", minEnergy: "3000", maxWeight: "50" }
    },

    // 🚙 RC & Hobby
    rc_car_3s: {
        label: "RC Car (3S)",
        values: { minVoltage: "6", maxVoltage: "16", minPower: "300", minEnergy: "50", maxWeight: "0.5" }
    },
    rc_car_4s: {
        label: "RC Car (4S)",
        values: { minVoltage: "8", maxVoltage: "20", minPower: "600", minEnergy: "80", maxWeight: "0.8" }
    }
};

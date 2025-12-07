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

// O objeto exportado (simples de editar)
export const USE_CASES: Record<string, UseCasePreset> = {
    custom: {
        label: "Custom / Manual",
        values: null
    },
    ebike_36v: {
        label: "E-Bike (36V Standard)",
        values: { minVoltage: "30", maxVoltage: "42", minPower: "250", minEnergy: "360" }
    },
    ebike_48v: {
        label: "E-Bike (48V High Power)",
        values: { minVoltage: "39", maxVoltage: "54.6", minPower: "750", minEnergy: "600" }
    },
    ebike_52v: {
        label: "E-Bike (52V Performance)",
        values: { minVoltage: "42", maxVoltage: "58.8", minPower: "1000", minEnergy: "800" }
    },
    esk8_12s: {
        label: "Electric Skateboard (12S)",
        values: { minVoltage: "38", maxVoltage: "50.4", minPower: "1500", minEnergy: "300", maxWeight: "4" }
    },
    solar_48v: {
        label: "Home Solar Storage (48V)",
        values: { minVoltage: "44", maxVoltage: "56", minPower: "5000", minEnergy: "5000", maxWeight: "100" }
    },
    // ⚡ Adiciona novos aqui facilmente:
    // drone_6s: {
    //   label: "FPV Drone (6S)",
    //   values: { minVoltage: "18", maxVoltage: "25.2", minPower: "800", minEnergy: "100" }
    // }
};
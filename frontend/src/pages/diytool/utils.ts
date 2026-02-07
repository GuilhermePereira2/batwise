import type { Configuration } from "./types";

export const formatUnit = (value: number, unit: "W" | "Wh") => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} k${unit}`;
  }
  return `${value.toFixed(0)} ${unit}`;
};

export const findBestConfigurations = (configs: Configuration[], targetPrice: number) => {
  if (!configs.length) return [];

  const findBest = (metric: (c: Configuration) => number, compare: "min" | "max" = "max") => {
    try {
      const result = configs.reduce((best, current) => {
        const bestMetric = metric(best);
        const currentMetric = metric(current);
        if (!isFinite(bestMetric) || !isFinite(currentMetric)) return best;
        return compare === "max" ? (currentMetric > bestMetric ? current : best) : (currentMetric < bestMetric ? current : best);
      });
      return result;
    } catch (e) {
      console.warn("Error in findBest:", e);
      return null;
    }
  };

  const calculateOptimalScore = (config: Configuration) => {
    if (!config.safety.is_safe) return 0;
    const energyDensity = config.battery_energy / config.battery_weight;
    const maxEnergyDensity = Math.max(...configs.map((c) => c.battery_energy / c.battery_weight));
    if (!isFinite(maxEnergyDensity)) return 0;
    const normalizedDensity = energyDensity / maxEnergyDensity;
    const priceDifference = Math.abs(config.total_price - targetPrice);
    const maxPriceDiff = Math.max(...configs.map((c) => Math.abs(c.total_price - targetPrice)));
    const normalizedPrice = maxPriceDiff > 0 ? 1 - priceDifference / maxPriceDiff : 0;
    return (normalizedDensity + normalizedPrice + config.safety.safety_score / 100) / 3;
  };

  const results = [
    { title: "Lowest Price", config: findBest((c) => c.total_price, "min"), metric: (c: Configuration) => `$${c.total_price.toFixed(2)}` },
    { title: "Highest Energy", config: findBest((c) => c.battery_energy), metric: (c: Configuration) => formatUnit(c.battery_energy, "Wh") },
    { title: "Highest Energy Density", config: findBest((c) => c.battery_energy / c.battery_weight), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg` },
    { title: "Best Value", config: findBest((c) => c.total_price / c.battery_energy), metric: (c: Configuration) => `${(c.total_price / c.battery_energy).toFixed(1)} $/Wh` },
    { title: "Lightest", config: findBest((c) => c.battery_weight, "min"), metric: (c: Configuration) => `${c.battery_weight.toFixed(1)} kg` },
    { title: "Optimal Balance", config: findBest((c) => calculateOptimalScore(c)), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg @ $${c.total_price.toFixed(0)}` },
  ];

  return results.filter((r) => r.config !== null && r.config !== undefined);
};

export const downloadCsvTemplate = (type: string) => {
  let headers = "";
  let filename = `${type}_template.csv`;

  switch (type) {
    case "cells":
      headers = "Brand,CellModelNo,Composition,Cell_Stack,NominalVoltage,ChargeVoltage,Capacity,MaxContinuousDischargeRate,MaxContinuousChargeRate,PeakDischargeCurrent,PeakChargeCurrent,Weight,Resistance,Price,Cell_Height,Cell_Width,Cell_Thickness,Cycles,Link";
      break;
    case "bms":
      headers = "brand,model,price,vdc_max,vdc_min,a_max,max_cells,master_price,slave_price,link";
      break;
    case "relays":
      headers = "brand,model,vdc_max,a_max,price,Link";
      break;
    case "fuses":
      headers = "brand,model,vdc_max,a_max,price,Link";
      break;
    case "cables":
      headers = "brand,model,section_mm2,vdc_max,a_max,price,Link";
      break;
    case "shunts":
      headers = "brand,model,vdc_max,a_max,price,Link";
      break;
    default:
      headers = "col1,col2";
  }

  const blob = new Blob([headers], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

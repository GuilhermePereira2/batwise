from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SimulationResult:
    """Annual dispatch result for one battery capacity and profile."""

    annual_cost_eur: float
    grid_import_kwh: float
    grid_export_kwh: float
    solar_to_battery_kwh: float
    grid_to_battery_kwh: float
    battery_to_load_kwh: float
    equivalent_cycles: float

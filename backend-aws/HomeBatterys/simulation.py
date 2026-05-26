from __future__ import annotations

from math import sqrt
from typing import Any, Dict, List, Optional

from .tariffs import should_allow_grid_arbitrage
from .types import SimulationResult


def simulate_capacity(
    capacity_kwh: float,
    load_kwh: List[float],
    pv_kwh: List[float],
    prices_eur_kwh: List[float],
    dod: float,
    roundtrip_efficiency: float,
    sell_price_eur_kwh: float,
    allow_grid_arbitrage: bool,
    return_series: bool = False
) -> SimulationResult:
    """Dispatch one battery capacity over the hourly profile.

    The dispatch policy is intentionally simple: charge from PV surplus, discharge
    into load when PV exists, and optionally do grid arbitrage for multi-period
    tariffs. The output is annual cost and energy-flow totals.
    """

    usable = max(0.0, capacity_kwh * dod)
    soc = usable * 0.50
    eff = sqrt(roundtrip_efficiency)

    price_min = min(prices_eur_kwh)
    price_max = max(prices_eur_kwh)
    allow_grid_arbitrage = allow_grid_arbitrage and price_max - price_min >= 0.05
    low_threshold = price_min + 0.005
    high_threshold = price_max - 0.005

    annual_cost = 0.0
    grid_import = 0.0
    grid_export = 0.0
    solar_to_battery = 0.0
    grid_to_battery = 0.0
    battery_to_load = 0.0
    has_pv_generation = sum(pv_kwh) > 1.0

    soc_series = [] if return_series else None

    for load, pv, price in zip(load_kwh, pv_kwh, prices_eur_kwh):
        if usable > 0 and allow_grid_arbitrage and price <= low_threshold:
            space = usable - soc
            charge_from_grid = max(0.0, space / eff)
            soc += charge_from_grid * eff
            grid_import += charge_from_grid
            grid_to_battery += charge_from_grid
            annual_cost += charge_from_grid * price

        net = pv - load
        if net >= 0:
            space = max(0.0, usable - soc)
            charge_from_solar = min(net, space / eff) if usable > 0 else 0.0
            soc += charge_from_solar * eff
            solar_to_battery += charge_from_solar
            export = net - charge_from_solar
            grid_export += export
            annual_cost -= export * sell_price_eur_kwh
            if return_series:
                soc_series.append(round(soc, 3))
            continue

        demand = -net
        if allow_grid_arbitrage:
            should_discharge = usable > 0 and price >= high_threshold
        else:
            should_discharge = usable > 0 and has_pv_generation
        discharge = 0.0
        if should_discharge:
            discharge = min(demand, soc * eff)
            soc -= discharge / eff
            battery_to_load += discharge

        from_grid = demand - discharge
        grid_import += from_grid
        annual_cost += from_grid * price
        
        if return_series:
            soc_series.append(round(soc, 3))

    equivalent_cycles = battery_to_load / usable if usable > 0 else 0.0
    return SimulationResult(
        annual_cost_eur=annual_cost,
        grid_import_kwh=grid_import,
        grid_export_kwh=grid_export,
        solar_to_battery_kwh=solar_to_battery,
        grid_to_battery_kwh=grid_to_battery,
        battery_to_load_kwh=battery_to_load,
        equivalent_cycles=equivalent_cycles,
        soc_series=soc_series,
        load_series=load_kwh if return_series else None,
        pv_series=pv_kwh if return_series else None
    )

def build_capacity_candidates(profile_summary: Dict[str, float], tariff: Dict[str, Any], catalog: Optional[Dict[str, Any]]) -> List[float]:
    """Build generic battery sizes to evaluate before catalogue matching."""

    daily_consumption = profile_summary["annual_consumption_kwh"] / 365
    daily_solar = profile_summary["annual_solar_kwh"] / 365

    if profile_summary["annual_solar_kwh"] > 0:
        max_capacity = max(
            4.0, min(30.0, max(daily_consumption, daily_solar) * 1.6))
    elif should_allow_grid_arbitrage(tariff):
        max_capacity = max(4.0, min(20.0, daily_consumption))
    else:
        max_capacity = max(2.0, min(10.0, daily_consumption * 0.5))

    values = {0.0}
    step = 0.5
    current = step
    while current <= max_capacity + 0.001:
        values.add(round(current, 2))
        current += step

    for battery in (catalog or {}).get("batteries", []):
        capacity = battery.get("specs", {}).get(
            "usable_capacity_kwh") or battery.get("specs", {}).get("capacity_kwh")
        if capacity:
            values.add(round(float(capacity), 2))

    return sorted(values)

def choose_technical_capacity(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Choose the smallest capacity that captures most technical savings."""

    non_zero = [row for row in rows if row["capacity_kwh"] > 0]
    if not non_zero:
        return rows[0]
    best_savings = max(row["annual_savings_eur"] for row in non_zero)
    if best_savings <= 0:
        return rows[0]
    for row in non_zero:
        if row["annual_savings_eur"] >= best_savings * 0.95:
            return row
    return max(non_zero, key=lambda row: row["annual_savings_eur"])

def estimate_catalog_cost(catalog: Optional[Dict[str, Any]]) -> float:
    """Estimate €/kWh from the battery catalogue for generic capacity scoring."""

    costs = []
    for battery in (catalog or {}).get("batteries", []):
        specs = battery.get("specs", {})
        capacity = float(specs.get("usable_capacity_kwh")
                         or specs.get("capacity_kwh") or 0)
        price = float(battery.get("pricing", {}).get("unit_price", 0) or 0)
        if capacity > 0 and price > 0:
            costs.append(price / capacity)
    if costs:
        return sum(costs) / len(costs)
    return 650.0

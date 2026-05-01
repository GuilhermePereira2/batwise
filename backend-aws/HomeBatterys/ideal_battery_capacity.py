from __future__ import annotations

from dataclasses import dataclass
from math import ceil, sqrt
from typing import Any, Dict, List, Optional, Tuple


MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_LOAD_FACTORS = [1.12, 1.08, 1.02, 0.96, 0.92, 0.90, 0.94, 0.94, 0.96, 1.00, 1.06, 1.10]
MONTH_SOLAR_FACTORS = [0.55, 0.70, 0.95, 1.15, 1.30, 1.40, 1.45, 1.30, 1.05, 0.80, 0.60, 0.50]

RESIDENTIAL_HOURLY_SHAPE = [
    0.45, 0.38, 0.34, 0.32, 0.34, 0.48,
    0.82, 1.05, 0.92, 0.72, 0.62, 0.58,
    0.64, 0.62, 0.60, 0.66, 0.82, 1.20,
    1.55, 1.62, 1.38, 1.05, 0.78, 0.58,
]


@dataclass
class SimulationResult:
    annual_cost_eur: float
    grid_import_kwh: float
    grid_export_kwh: float
    solar_to_battery_kwh: float
    grid_to_battery_kwh: float
    battery_to_load_kwh: float
    equivalent_cycles: float


def optimize_home_battery(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    solar: Optional[Dict[str, Any]] = None,
    assumptions: Optional[Dict[str, Any]] = None,
    catalog: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Estimate the best home battery size from simulator data.

    The frontend currently sends either house-level estimates or electricity-bill
    values. This module converts those inputs into a representative hourly year,
    simulates battery dispatch, and ranks capacities by economic value.
    """

    assumptions = assumptions or {}
    solar = solar or {}

    profile, profile_summary = build_hourly_profile(mode, input_data, tariff, solar)
    solar_peak_kwp = estimate_recommended_solar_peak_kw(profile_summary, solar)
    if profile_summary["annual_solar_kwh"] <= 0 and solar_peak_kwp > 0:
        recommended_solar = {
            **solar,
            "has_solar": True,
            "peak_kw": solar_peak_kwp,
            "country": solar.get("country", "Portugal"),
            "city": solar.get("city", "Lisboa"),
        }
        profile, profile_summary = build_hourly_profile(mode, input_data, tariff, recommended_solar)
    prices = build_hourly_prices(tariff)

    dod = clamp_float(assumptions.get("battery_dod", 0.90), 0.50, 1.0)
    roundtrip_efficiency = clamp_float(
        assumptions.get("roundtrip_efficiency", 1 - float(assumptions.get("system_losses", 0.10))),
        0.70,
        0.98,
    )
    sell_price = max(0.0, float(assumptions.get("sell_price_eur_kwh", 0.05)))
    battery_cost_eur_kwh = max(0.0, float(assumptions.get("battery_cost_eur_kwh", estimate_catalog_cost(catalog))))
    project_years = max(1, int(assumptions.get("project_years", 12)))
    discount_rate = clamp_float(assumptions.get("discount_rate", 0.05), 0.0, 0.20)
    installation_margin = clamp_float(assumptions.get("installation_margin", 0.25), 0.0, 1.0)

    base = simulate_capacity(
        capacity_kwh=0.0,
        load_kwh=profile["load_kwh"],
        pv_kwh=profile["pv_kwh"],
        prices_eur_kwh=prices,
        dod=dod,
        roundtrip_efficiency=roundtrip_efficiency,
        sell_price_eur_kwh=sell_price,
        allow_grid_arbitrage=False,
    )
    no_system_base = simulate_capacity(
        capacity_kwh=0.0,
        load_kwh=profile["load_kwh"],
        pv_kwh=[0.0 for _ in profile["pv_kwh"]],
        prices_eur_kwh=prices,
        dod=dod,
        roundtrip_efficiency=roundtrip_efficiency,
        sell_price_eur_kwh=sell_price,
        allow_grid_arbitrage=False,
    )

    candidates = build_capacity_candidates(profile_summary, tariff, catalog)
    allow_grid_arbitrage = should_allow_grid_arbitrage(tariff)
    rows = []

    for capacity in candidates:
        result = simulate_capacity(
            capacity_kwh=capacity,
            load_kwh=profile["load_kwh"],
            pv_kwh=profile["pv_kwh"],
            prices_eur_kwh=prices,
            dod=dod,
            roundtrip_efficiency=roundtrip_efficiency,
            sell_price_eur_kwh=sell_price,
            allow_grid_arbitrage=allow_grid_arbitrage and profile_summary["annual_solar_kwh"] <= 0,
        )
        annual_savings = base.annual_cost_eur - result.annual_cost_eur
        capex = capacity * battery_cost_eur_kwh
        npv = discounted_value(annual_savings, project_years, discount_rate) - capex
        payback = capex / annual_savings if annual_savings > 0 and capex > 0 else None
        rows.append(
            {
                "capacity_kwh": round(capacity, 2),
                "usable_capacity_kwh": round(capacity * dod, 2),
                "annual_cost_eur": round(result.annual_cost_eur, 2),
                "annual_savings_eur": round(annual_savings, 2),
                "capex_estimated_eur": round(capex, 2),
                "payback_years": round(payback, 1) if payback else None,
                "npv_eur": round(npv, 2),
                "grid_import_kwh": round(result.grid_import_kwh, 1),
                "grid_export_kwh": round(result.grid_export_kwh, 1),
                "battery_to_load_kwh": round(result.battery_to_load_kwh, 1),
                "equivalent_cycles": round(result.equivalent_cycles, 1),
            }
        )

    best_economic = max(rows, key=lambda row: row["npv_eur"]) if rows else None
    technical = choose_technical_capacity(rows)
    if best_economic and best_economic["capacity_kwh"] > 0 and best_economic["npv_eur"] > 0:
        selected = best_economic
        selection_reason = "economic_npv"
    elif technical and technical["annual_savings_eur"] > 0:
        selected = technical
        selection_reason = "technical_savings"
    else:
        selected = rows[0]
        selection_reason = "no_economic_case"

    recommendations = rank_catalog(
        catalog,
        selected,
        base,
        profile,
        prices,
        dod,
        roundtrip_efficiency,
        sell_price,
        allow_grid_arbitrage and profile_summary["annual_solar_kwh"] <= 0,
        no_system_base,
        solar_peak_kwp,
        installation_margin,
    )

    return {
        "summary": {
            "annual_consumption_estimated": round(profile_summary["annual_consumption_kwh"], 1),
            "annual_solar_estimated": round(profile_summary["annual_solar_kwh"], 1),
            "daily_avg_kwh": round(profile_summary["annual_consumption_kwh"] / 365, 2),
            "ideal_capacity_kwh": selected["capacity_kwh"],
            "ideal_usable_capacity_kwh": selected["usable_capacity_kwh"],
            "economic_capacity_kwh": best_economic["capacity_kwh"] if best_economic else 0,
            "technical_capacity_kwh": technical["capacity_kwh"] if technical else 0,
            "selection_reason": selection_reason,
            "no_battery_annual_cost_eur": round(base.annual_cost_eur, 2),
            "optimized_annual_cost_eur": selected["annual_cost_eur"],
            "savings_annual_eur": selected["annual_savings_eur"],
            "payback_years": selected["payback_years"],
        },
        "recommendations": recommendations,
        "capacity_curve": rows,
        "assumptions_used": {
            "battery_dod": dod,
            "roundtrip_efficiency": roundtrip_efficiency,
            "sell_price_eur_kwh": sell_price,
            "battery_cost_eur_kwh": round(battery_cost_eur_kwh, 2),
            "project_years": project_years,
            "discount_rate": discount_rate,
            "grid_arbitrage_enabled": allow_grid_arbitrage,
            "recommended_solar_peak_kwp": round(solar_peak_kwp, 2),
            "installation_margin": installation_margin,
        },
        "notes": build_notes(mode, profile_summary, selected, selection_reason)
        + ["O preço instalado estimado soma bateria, inversor, painéis e uma margem de instalação configurável."],
    }


def build_hourly_profile(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    solar: Dict[str, Any],
) -> Tuple[Dict[str, List[float]], Dict[str, float]]:
    monthly_consumption = estimate_monthly_consumption(mode, input_data, tariff)
    monthly_solar = estimate_monthly_solar(input_data, solar)

    load: List[float] = []
    pv: List[float] = []
    tariff_type = tariff.get("type", "simple")

    for month_index, days in enumerate(MONTH_DAYS):
        period_weights = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}
        solar_weights = [0.0 for _ in range(days * 24)]

        for day in range(days):
            for hour in range(24):
                period = tariff_period(hour, tariff_type)
                weight = RESIDENTIAL_HOURLY_SHAPE[hour] * MONTH_LOAD_FACTORS[month_index]
                period_weights[period] += weight

                solar_shape = solar_hour_weight(hour)
                solar_weights[day * 24 + hour] = solar_shape

        month_load: List[float] = []
        for day in range(days):
            for hour in range(24):
                period = tariff_period(hour, tariff_type)
                target_kwh = monthly_consumption.get(period, 0.0)
                if tariff_type == "simple":
                    target_kwh = monthly_consumption.get("simple", 0.0)
                weight = RESIDENTIAL_HOURLY_SHAPE[hour] * MONTH_LOAD_FACTORS[month_index]
                divisor = period_weights[period] or 1.0
                month_load.append(target_kwh * weight / divisor)

        month_solar_total = monthly_solar[month_index]
        solar_divisor = sum(solar_weights) or 1.0
        month_pv = [month_solar_total * weight / solar_divisor for weight in solar_weights]

        load.extend(month_load)
        pv.extend(month_pv)

    annual_consumption = sum(load)
    annual_solar = sum(pv)
    return (
        {"load_kwh": load, "pv_kwh": pv},
        {"annual_consumption_kwh": annual_consumption, "annual_solar_kwh": annual_solar},
    )


def estimate_monthly_consumption(mode: str, input_data: Dict[str, Any], tariff: Dict[str, Any]) -> Dict[str, float]:
    tariff_type = tariff.get("type", "simple")

    if mode == "house":
        occupants = max(1, int(float(input_data.get("occupants", 1))))
        area_m2 = max(20.0, float(input_data.get("area_m2", 80)))
        floors = max(1, int(float(input_data.get("floors", 1))))
        annual = 1200 + occupants * 850 + max(0.0, area_m2 - 60) * 6 + (floors - 1) * 250
        monthly = annual / 12
        return split_monthly_total(monthly, tariff_type)

    history = input_data.get("history") or []
    months = max(1, int(float(input_data.get("historyMonths", len(history) or 1))))
    period_totals = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}

    for entry in history[:months]:
        if not isinstance(entry, dict):
            period_totals["simple"] += float(entry or 0)
            continue
        period_totals["simple"] += float(entry.get("simple", 0) or 0)
        period_totals["offPeak"] += float(entry.get("offPeak", 0) or 0)
        period_totals["peak"] += float(entry.get("peak", 0) or 0)
        period_totals["ponta"] += float(entry.get("ponta", 0) or 0)

    if sum(period_totals.values()) <= 0:
        monthly_avg = float(input_data.get("monthly_avg", 0) or 0)
        if monthly_avg <= 0:
            consumption = input_data.get("consumption") or {}
            monthly_avg = sum(float(value or 0) for value in consumption.values())
        return split_monthly_total(monthly_avg, tariff_type)

    return {key: value / months for key, value in period_totals.items()}


def split_monthly_total(monthly_total: float, tariff_type: str) -> Dict[str, float]:
    if tariff_type == "bi":
        return {"simple": 0.0, "offPeak": monthly_total * 0.38, "peak": monthly_total * 0.62, "ponta": 0.0}
    if tariff_type == "tri":
        return {"simple": 0.0, "offPeak": monthly_total * 0.34, "peak": monthly_total * 0.46, "ponta": monthly_total * 0.20}
    return {"simple": monthly_total, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}


def estimate_monthly_solar(input_data: Dict[str, Any], solar: Dict[str, Any]) -> List[float]:
    if not solar.get("has_solar"):
        return [0.0 for _ in range(12)]

    history = input_data.get("history") or []
    production_values = [
        float(entry.get("production", 0) or 0)
        for entry in history
        if isinstance(entry, dict) and float(entry.get("production", 0) or 0) > 0
    ]
    if production_values:
        monthly_avg = sum(production_values) / len(production_values)
        return [monthly_avg for _ in range(12)]

    peak_kw = max(0.0, float(solar.get("peak_kw", 0) or 0))
    annual_yield = peak_kw * solar_yield_kwh_per_kwp(solar)
    factor_sum = sum(MONTH_SOLAR_FACTORS)
    return [annual_yield * factor / factor_sum for factor in MONTH_SOLAR_FACTORS]


def estimate_recommended_solar_peak_kw(profile_summary: Dict[str, float], solar: Dict[str, Any]) -> float:
    existing_peak = float(solar.get("peak_kw", 0) or 0)
    if solar.get("has_solar") and existing_peak > 0:
        return round(existing_peak, 2)

    annual_consumption = profile_summary["annual_consumption_kwh"]
    target_peak = annual_consumption / solar_yield_kwh_per_kwp(solar or {"country": "Portugal", "city": "Lisboa"})
    return round(max(2.0, min(10.0, target_peak)), 2)


def solar_yield_kwh_per_kwp(solar: Dict[str, Any]) -> float:
    country = str(solar.get("country", "")).lower()
    city = str(solar.get("city", "")).lower()
    if "portugal" not in country:
        return 1350.0
    if any(name in city for name in ["faro", "evora", "beja"]):
        return 1650.0
    if any(name in city for name in ["porto", "braga", "viana"]):
        return 1350.0
    return 1500.0


def tariff_period(hour: int, tariff_type: str) -> str:
    if tariff_type == "bi":
        return "offPeak" if hour < 8 or hour >= 22 else "peak"
    if tariff_type == "tri":
        if hour < 8:
            return "offPeak"
        if 18 <= hour < 22:
            return "ponta"
        return "peak"
    return "simple"


def solar_hour_weight(hour: int) -> float:
    weights = {
        6: 0.05,
        7: 0.20,
        8: 0.45,
        9: 0.70,
        10: 0.90,
        11: 1.00,
        12: 1.00,
        13: 0.95,
        14: 0.80,
        15: 0.60,
        16: 0.35,
        17: 0.15,
        18: 0.04,
    }
    return weights.get(hour, 0.0)


def build_hourly_prices(tariff: Dict[str, Any]) -> List[float]:
    tariff_type = tariff.get("type", "simple")
    prices = tariff.get("prices") or {}
    defaults = {"simple": 0.22, "offPeak": 0.14, "peak": 0.24, "ponta": 0.30}
    hourly = []
    for days in MONTH_DAYS:
        for _day in range(days):
            for hour in range(24):
                period = tariff_period(hour, tariff_type)
                hourly.append(float(prices.get(period, defaults.get(period, defaults["simple"])) or defaults["simple"]))
    return hourly


def simulate_capacity(
    capacity_kwh: float,
    load_kwh: List[float],
    pv_kwh: List[float],
    prices_eur_kwh: List[float],
    dod: float,
    roundtrip_efficiency: float,
    sell_price_eur_kwh: float,
    allow_grid_arbitrage: bool,
) -> SimulationResult:
    usable = max(0.0, capacity_kwh * dod)
    soc = usable * 0.50
    eff = sqrt(roundtrip_efficiency)

    price_min = min(prices_eur_kwh)
    price_max = max(prices_eur_kwh)
    low_threshold = price_min + 0.005
    high_threshold = price_max - 0.005

    annual_cost = 0.0
    grid_import = 0.0
    grid_export = 0.0
    solar_to_battery = 0.0
    grid_to_battery = 0.0
    battery_to_load = 0.0
    has_pv_generation = sum(pv_kwh) > 1.0

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
            continue

        demand = -net
        should_discharge = usable > 0 and (has_pv_generation or (allow_grid_arbitrage and price >= high_threshold))
        discharge = 0.0
        if should_discharge:
            discharge = min(demand, soc * eff)
            soc -= discharge / eff
            battery_to_load += discharge

        from_grid = demand - discharge
        grid_import += from_grid
        annual_cost += from_grid * price

    equivalent_cycles = battery_to_load / usable if usable > 0 else 0.0
    return SimulationResult(
        annual_cost_eur=annual_cost,
        grid_import_kwh=grid_import,
        grid_export_kwh=grid_export,
        solar_to_battery_kwh=solar_to_battery,
        grid_to_battery_kwh=grid_to_battery,
        battery_to_load_kwh=battery_to_load,
        equivalent_cycles=equivalent_cycles,
    )

def build_capacity_candidates(profile_summary: Dict[str, float], tariff: Dict[str, Any], catalog: Optional[Dict[str, Any]]) -> List[float]:
    daily_consumption = profile_summary["annual_consumption_kwh"] / 365
    daily_solar = profile_summary["annual_solar_kwh"] / 365

    if profile_summary["annual_solar_kwh"] > 0:
        max_capacity = max(4.0, min(30.0, max(daily_consumption, daily_solar) * 1.6))
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
        capacity = battery.get("specs", {}).get("usable_capacity_kwh") or battery.get("specs", {}).get("capacity_kwh")
        if capacity:
            values.add(round(float(capacity), 2))

    return sorted(values)


def choose_technical_capacity(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
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


def rank_catalog(
    catalog: Optional[Dict[str, Any]],
    selected: Dict[str, Any],
    base: SimulationResult,
    profile: Dict[str, List[float]],
    prices: List[float],
    dod: float,
    roundtrip_efficiency: float,
    sell_price: float,
    allow_grid_arbitrage: bool,
    no_system_base: SimulationResult,
    solar_peak_kwp: float,
    installation_margin: float,
) -> List[Dict[str, Any]]:
    if not catalog:
        return []

    inverters = catalog.get("inverters", [])
    panels = catalog.get("solar_panels", [])
    recommendations = []
    target = max(0.5, float(selected["capacity_kwh"]))

    for battery in catalog.get("batteries", []):
        specs = battery.get("specs", {})
        capacity = float(specs.get("usable_capacity_kwh") or specs.get("capacity_kwh") or 0)
        if capacity <= 0:
            continue
        inverter = select_inverter_for_battery(battery, inverters, catalog.get("compatibility"))
        panel_set = select_solar_panel_set(panels, battery, inverter, solar_peak_kwp, catalog.get("compatibility"))
        result = simulate_capacity(
            capacity_kwh=capacity,
            load_kwh=profile["load_kwh"],
            pv_kwh=profile["pv_kwh"],
            prices_eur_kwh=prices,
            dod=dod,
            roundtrip_efficiency=roundtrip_efficiency,
            sell_price_eur_kwh=sell_price,
            allow_grid_arbitrage=allow_grid_arbitrage,
        )
        battery_price = float(battery.get("pricing", {}).get("unit_price", 0) or 0)
        inverter_price = float((inverter or {}).get("pricing", {}).get("unit_price", 0) or 0)
        panels_price = float((panel_set or {}).get("total_price_eur", 0) or 0)
        hardware_total = battery_price + inverter_price + panels_price
        installation_margin_eur = hardware_total * installation_margin
        capex = hardware_total + installation_margin_eur
        annual_savings = no_system_base.annual_cost_eur - result.annual_cost_eur
        payback = capex / annual_savings if annual_savings > 0 else None
        fit_penalty = abs(capacity - target) / target

        recommendations.append(
            {
                "battery": battery,
                "inverter": inverter,
                "solar_panels": panel_set,
                "capex_total_eur": round(capex, 2),
                "hardware_total_eur": round(hardware_total, 2),
                "installation_margin_eur": round(installation_margin_eur, 2),
                "savings_annual_eur": round(annual_savings, 2),
                "payback_years": round(payback, 1) if payback else None,
                "fit_to_ideal": round(max(0.0, 1.0 - fit_penalty), 2),
                "simulated_capacity_kwh": round(capacity, 2),
            }
        )

    return sorted(
        recommendations,
        key=lambda item: (
            -item["fit_to_ideal"],
            item["payback_years"] if item["payback_years"] is not None else 999,
            item["capex_total_eur"],
        ),
    )[:3]


def select_solar_panel_set(
    panels: List[Dict[str, Any]],
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    target_peak_kwp: float,
    compatibility: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    if not panels or target_peak_kwp <= 0:
        return None

    compatible_panels = [
        panel for panel in panels
        if is_component_set_compatible(battery, inverter, panel, compatibility)
    ]
    if not compatible_panels:
        return None

    inverter_power = float((inverter or {}).get("specs", {}).get("power_kw", 0) or 0)
    target_kwp = max(target_peak_kwp, inverter_power * 0.9 if inverter_power > 0 else target_peak_kwp)
    target_kwp = min(target_kwp, inverter_power * 1.35) if inverter_power > 0 else target_kwp

    def score(panel: Dict[str, Any]) -> tuple:
        power_w = float(panel.get("specs", {}).get("power_w", 0) or 0)
        price = float(panel.get("pricing", {}).get("unit_price", 0) or 0)
        efficiency = float(panel.get("specs", {}).get("efficiency_pct", 0) or 0)
        price_per_wp = price / power_w if power_w > 0 and price > 0 else 999
        return (price_per_wp, -efficiency)

    panel = min(compatible_panels, key=score)
    power_w = float(panel.get("specs", {}).get("power_w", 0) or 0)
    unit_price = float(panel.get("pricing", {}).get("unit_price", 0) or 0)
    if power_w <= 0:
        return None

    quantity = max(1, ceil((target_kwp * 1000) / power_w))
    array_power_kwp = quantity * power_w / 1000

    return {
        "panel": panel,
        "quantity": quantity,
        "array_power_kwp": round(array_power_kwp, 2),
        "total_price_eur": round(quantity * unit_price, 2),
    }


def select_inverter_for_battery(
    battery: Dict[str, Any],
    inverters: List[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    if not inverters:
        return None

    battery_power = float(battery.get("specs", {}).get("power_kw", 0) or 0)
    battery_brand = str(battery.get("brand", "")).lower()
    compatible_inverters = [
        inverter for inverter in inverters
        if is_component_set_compatible(battery, inverter, None, compatibility)
    ]
    if not compatible_inverters:
        return None

    def score(inverter: Dict[str, Any]) -> tuple:
        specs = inverter.get("specs", {})
        inverter_power = float(specs.get("power_kw", 0) or 0)
        power_gap = abs(inverter_power - battery_power) if battery_power > 0 else 0
        undersized_penalty = 10 if battery_power > 0 and inverter_power < battery_power * 0.75 else 0
        hybrid_bonus = -1 if specs.get("is_hybrid") else 0

        compatible_brands = [str(brand).lower() for brand in specs.get("compatible_battery_brands", [])]
        brand_penalty = 0
        if compatible_brands and battery_brand not in compatible_brands:
            brand_penalty = 20

        price = float(inverter.get("pricing", {}).get("unit_price", 0) or 0)
        return (brand_penalty, undersized_penalty, power_gap, hybrid_bonus, price)

    return min(compatible_inverters, key=score)


def is_component_set_compatible(
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    solar_panel: Optional[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]],
) -> bool:
    if not compatibility:
        return True

    default = bool(compatibility.get("default_compatible", True))
    battery_id = battery.get("id")
    inverter_id = (inverter or {}).get("id")
    solar_panel_id = (solar_panel or {}).get("id")
    matched = None
    matched_specificity = -1

    for rule in compatibility.get("rules", []):
        rule_battery = rule.get("battery_id")
        rule_inverter = rule.get("inverter_id")
        rule_panel = rule.get("solar_panel_id")
        battery_matches = rule_battery in (battery_id, "*")
        inverter_matches = rule_inverter in (inverter_id, "*")
        panel_matches = rule_panel in (solar_panel_id, "*", None)
        if solar_panel is None and rule_panel not in ("*", None):
            panel_matches = False
        if not battery_matches or not inverter_matches or not panel_matches:
            continue

        specificity = (
            int(rule_battery == battery_id)
            + int(rule_inverter == inverter_id)
            + int(rule_panel == solar_panel_id)
        )
        if specificity >= matched_specificity:
            matched = rule
            matched_specificity = specificity

    if matched is None:
        return default

    return bool(matched.get("compatible", default))


def should_allow_grid_arbitrage(tariff: Dict[str, Any]) -> bool:
    prices = tariff.get("prices") or {}
    used_prices = [float(value or 0) for value in prices.values() if float(value or 0) > 0]
    return len(used_prices) >= 2 and max(used_prices) - min(used_prices) >= 0.05


def estimate_catalog_cost(catalog: Optional[Dict[str, Any]]) -> float:
    costs = []
    for battery in (catalog or {}).get("batteries", []):
        specs = battery.get("specs", {})
        capacity = float(specs.get("usable_capacity_kwh") or specs.get("capacity_kwh") or 0)
        price = float(battery.get("pricing", {}).get("unit_price", 0) or 0)
        if capacity > 0 and price > 0:
            costs.append(price / capacity)
    if costs:
        return sum(costs) / len(costs)
    return 650.0


def discounted_value(annual_value: float, years: int, discount_rate: float) -> float:
    if discount_rate <= 0:
        return annual_value * years
    return sum(annual_value / ((1 + discount_rate) ** year) for year in range(1, years + 1))


def build_notes(mode: str, profile_summary: Dict[str, float], selected: Dict[str, Any], reason: str) -> List[str]:
    notes = [
        "Cálculo baseado num perfil horário sintético anual gerado a partir dos dados introduzidos.",
        "Preços de catálogo não incluem instalação, legalização ou alterações ao quadro elétrico.",
    ]
    if mode == "house":
        notes.append("O consumo foi estimado pelas características da casa; a fatura real melhora a precisão.")
    if profile_summary["annual_solar_kwh"] <= 0:
        notes.append("Sem produção solar, a bateria só cria valor económico relevante quando há diferença forte entre períodos tarifários.")
    if reason == "technical_savings":
        notes.append("A capacidade recomendada maximiza a maior parte da poupança técnica, embora o retorno económico dependa do preço final instalado.")
    if selected["capacity_kwh"] == 0:
        notes.append("Com estes dados, não há caso económico claro para instalar bateria.")
    return notes


def clamp_float(value: Any, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, float(value)))

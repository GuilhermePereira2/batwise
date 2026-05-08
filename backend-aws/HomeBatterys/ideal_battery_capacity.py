from __future__ import annotations

from dataclasses import dataclass
from math import ceil, sqrt
from typing import Any, Dict, List, Optional, Tuple


MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_LOAD_FACTORS = [1.12, 1.08, 1.02, 0.96, 0.92, 0.90, 0.94, 0.94, 0.96, 1.00, 1.06, 1.10]
MONTH_SOLAR_FACTORS = [0.55, 0.70, 0.95, 1.15, 1.30, 1.40, 1.45, 1.30, 1.05, 0.80, 0.60, 0.50]
DEFAULT_EV_CONSUMPTION_KWH_PER_KM = 0.18
DEFAULT_PANEL_AREA_M2 = 2.0
DEFAULT_USABLE_ROOF_RATIO = 0.75

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
    component_margin = clamp_float(assumptions.get("component_margin", 0.10), 0.0, 1.0)
    installation_margin = clamp_float(assumptions.get("installation_margin", 0.10), 0.0, 1.0)

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
            allow_grid_arbitrage=allow_grid_arbitrage,
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
        allow_grid_arbitrage,
        no_system_base,
        solar_peak_kwp,
        component_margin,
        installation_margin,
        solar,
        estimate_roof_area_m2(input_data),
    )

    return {
        "summary": {
            "annual_consumption_estimated": round(profile_summary["annual_consumption_kwh"], 1),
            "annual_solar_estimated": round(profile_summary["annual_solar_kwh"], 1),
            "annual_ev_consumption_estimated": round(profile_summary.get("annual_ev_consumption_kwh", 0.0), 1),
            "existing_battery_capacity_kwh": round(get_existing_battery_capacity_kwh(solar), 2),
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
            "component_margin": component_margin,
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
    monthly_consumption = estimate_monthly_consumption(mode, input_data, tariff, include_ev=False)
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

        month_ev_load = estimate_monthly_ev_hourly_load(input_data, days)
        if month_ev_load:
            month_load = [base + ev for base, ev in zip(month_load, month_ev_load)]

        month_solar_total = monthly_solar[month_index]
        solar_divisor = sum(solar_weights) or 1.0
        month_pv = [month_solar_total * weight / solar_divisor for weight in solar_weights]

        load.extend(month_load)
        pv.extend(month_pv)

    annual_consumption = sum(load)
    annual_solar = sum(pv)
    annual_ev_consumption = estimate_monthly_ev_consumption(input_data) * 12
    return (
        {"load_kwh": load, "pv_kwh": pv},
        {
            "annual_consumption_kwh": annual_consumption,
            "annual_solar_kwh": annual_solar,
            "annual_ev_consumption_kwh": annual_ev_consumption,
        },
    )


def estimate_monthly_consumption(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    include_ev: bool = True,
) -> Dict[str, float]:
    tariff_type = tariff.get("type", "simple")
    monthly_ev_by_period = estimate_monthly_ev_consumption_by_period(input_data, tariff_type) if include_ev else {}

    if mode == "house":
        occupants = max(1, int(float(input_data.get("occupants", 1))))
        area_m2 = max(20.0, float(input_data.get("area_m2", 80)))
        floors = max(1, int(float(input_data.get("floors", 1))))
        annual = 1200 + occupants * 850 + max(0.0, area_m2 - 60) * 6 + (floors - 1) * 250
        monthly = annual / 12
        return add_ev_to_monthly_consumption(split_monthly_total(monthly, tariff_type), monthly_ev_by_period)

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
        return add_ev_to_monthly_consumption(split_monthly_total(monthly_avg, tariff_type), monthly_ev_by_period)

    return add_ev_to_monthly_consumption({key: value / months for key, value in period_totals.items()}, monthly_ev_by_period)


def estimate_monthly_ev_consumption(input_data: Dict[str, Any]) -> float:
    return sum(estimate_monthly_ev_consumption_by_period(input_data, "simple").values())


def estimate_monthly_ev_hourly_load(input_data: Dict[str, Any], days: int) -> List[float]:
    ev_data = input_data.get("electric_vehicles") or {}
    hourly = [0.0 for _ in range(days * 24)]
    if not ev_data.get("has_electric_vehicle"):
        return hourly

    vehicles = ev_data.get("vehicles") or []
    for vehicle in vehicles:
        if not isinstance(vehicle, dict):
            continue
        daily_km = max(0.0, float(vehicle.get("daily_km", 0) or 0))
        consumption = max(
            0.05,
            float(vehicle.get("consumption_kwh_per_km", DEFAULT_EV_CONSUMPTION_KWH_PER_KM) or DEFAULT_EV_CONSUMPTION_KWH_PER_KM),
        )
        daily_kwh = daily_km * consumption
        schedule = str(vehicle.get("charging_schedule", "night") or "night")
        hour_shares = ev_charging_hour_shares(schedule)
        for day in range(days):
            for hour, share in hour_shares.items():
                hourly[day * 24 + hour] += daily_kwh * share

    return hourly


def ev_charging_hour_shares(schedule: str) -> Dict[int, float]:
    night_hours = [0, 1, 2, 3, 4, 5]
    day_hours = [10, 11, 12, 13, 14, 15]

    if schedule == "day":
        return {hour: 1 / len(day_hours) for hour in day_hours}
    if schedule == "mixed":
        shares: Dict[int, float] = {}
        for hour in night_hours:
            shares[hour] = shares.get(hour, 0.0) + 0.5 / len(night_hours)
        for hour in day_hours:
            shares[hour] = shares.get(hour, 0.0) + 0.5 / len(day_hours)
        return shares
    return {hour: 1 / len(night_hours) for hour in night_hours}


def estimate_monthly_ev_consumption_by_period(input_data: Dict[str, Any], tariff_type: str) -> Dict[str, float]:
    ev_data = input_data.get("electric_vehicles") or {}
    periods = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}
    if not ev_data.get("has_electric_vehicle"):
        return periods

    vehicles = ev_data.get("vehicles") or []
    for vehicle in vehicles:
        if not isinstance(vehicle, dict):
            continue
        daily_km = max(0.0, float(vehicle.get("daily_km", 0) or 0))
        consumption = max(
            0.05,
            float(vehicle.get("consumption_kwh_per_km", DEFAULT_EV_CONSUMPTION_KWH_PER_KM) or DEFAULT_EV_CONSUMPTION_KWH_PER_KM),
        )
        monthly_kwh = daily_km * consumption * (365 / 12)
        schedule = str(vehicle.get("charging_schedule", "night") or "night")
        for period, share in ev_charging_period_shares(schedule, tariff_type).items():
            periods[period] = periods.get(period, 0.0) + monthly_kwh * share

    return periods


def ev_charging_period_shares(schedule: str, tariff_type: str) -> Dict[str, float]:
    if tariff_type == "simple":
        return {"simple": 1.0}

    if schedule == "day":
        return {"peak": 1.0}
    if schedule == "mixed":
        return {"offPeak": 0.5, "peak": 0.5}
    return {"offPeak": 1.0}


def add_ev_to_monthly_consumption(monthly: Dict[str, float], monthly_ev_by_period: Dict[str, float]) -> Dict[str, float]:
    if sum(monthly_ev_by_period.values()) <= 0:
        return monthly

    updated = dict(monthly)
    for period, value in monthly_ev_by_period.items():
        updated[period] = updated.get(period, 0.0) + value
    return updated


def estimate_roof_area_m2(input_data: Dict[str, Any]) -> Optional[float]:
    if input_data.get("roof_area_m2") is not None:
        return max(0.0, float(input_data.get("roof_area_m2") or 0))

    site = input_data.get("site") or {}
    area_m2 = input_data.get("area_m2", site.get("area_m2"))
    floors = input_data.get("floors", site.get("floors", 1))
    if area_m2 is None:
        return None

    return max(0.0, float(area_m2 or 0) / max(1, int(float(floors or 1))))


def split_monthly_total(monthly_total: float, tariff_type: str) -> Dict[str, float]:
    if tariff_type == "bi":
        return {"simple": 0.0, "offPeak": monthly_total * 0.38, "peak": monthly_total * 0.62, "ponta": 0.0}
    if tariff_type == "tri":
        return {"simple": 0.0, "offPeak": monthly_total * 0.34, "peak": monthly_total * 0.46, "ponta": monthly_total * 0.20}
    return {"simple": monthly_total, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}


def estimate_monthly_solar(input_data: Dict[str, Any], solar: Dict[str, Any]) -> List[float]:
    if not solar.get("has_solar"):
        return [0.0 for _ in range(12)]

    peak_kw = get_existing_solar_peak_kwp(solar)
    history = input_data.get("history") or []
    production_values = [
        float(entry.get("production", 0) or 0)
        for entry in history
        if isinstance(entry, dict) and float(entry.get("production", 0) or 0) > 0
    ]
    if production_values:
        monthly_avg = sum(production_values) / len(production_values)
        existing_peak = get_existing_solar_peak_kwp(solar)
        if existing_peak > 0 and peak_kw > existing_peak:
            monthly_avg *= peak_kw / existing_peak
        return [monthly_avg for _ in range(12)]

    annual_yield = peak_kw * solar_yield_kwh_per_kwp(solar)
    factor_sum = sum(MONTH_SOLAR_FACTORS)
    return [annual_yield * factor / factor_sum for factor in MONTH_SOLAR_FACTORS]


def estimate_recommended_solar_peak_kw(profile_summary: Dict[str, float], solar: Dict[str, Any]) -> float:
    existing_peak = get_existing_solar_peak_kwp(solar)
    if solar.get("has_solar") and existing_peak > 0:
        return round(existing_peak, 2)

    annual_consumption = profile_summary["annual_consumption_kwh"]
    target_peak = annual_consumption / solar_yield_kwh_per_kwp(solar or {"country": "Portugal", "city": "Lisboa"})
    return round(max(2.0, min(10.0, target_peak)), 2)


def get_existing_solar_peak_kwp(solar: Optional[Dict[str, Any]]) -> float:
    if not (solar or {}).get("has_solar"):
        return 0.0
    try:
        return max(0.0, float((solar or {}).get("peak_kw", 0) or 0))
    except (TypeError, ValueError):
        return 0.0


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
    hourly = []
    for days in MONTH_DAYS:
        for _day in range(days):
            for hour in range(24):
                period = tariff_period(hour, tariff_type)
                hourly.append(get_active_tariff_price(tariff, period))
    return hourly


def active_tariff_periods(tariff_type: str) -> List[str]:
    if tariff_type == "bi":
        return ["offPeak", "peak"]
    if tariff_type == "tri":
        return ["offPeak", "peak", "ponta"]
    return ["simple"]


def get_active_tariff_price(tariff: Dict[str, Any], period: str) -> float:
    tariff_type = tariff.get("type", "simple")
    active_periods = active_tariff_periods(tariff_type)
    prices = tariff.get("prices") or {}
    fallback_by_type = {
        "simple": {"simple": 0.22},
        "bi": {"offPeak": 0.14, "peak": 0.24},
        "tri": {"offPeak": 0.14, "peak": 0.24, "ponta": 0.30},
    }

    if period not in active_periods:
        period = active_periods[0]

    value = prices.get(period)
    if value is None:
        value = fallback_by_type.get(tariff_type, fallback_by_type["simple"]).get(period, 0.22)
    return float(value or 0)


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
    component_margin: float,
    installation_margin: float,
    solar: Optional[Dict[str, Any]] = None,
    roof_area_m2: Optional[float] = None,
) -> List[Dict[str, Any]]:
    if not catalog:
        return []

    inverters = catalog.get("inverters", [])
    panels = catalog.get("solar_panels", [])
    recommendations = []
    target = max(0.5, float(selected["capacity_kwh"]))
    has_existing_solar = bool((solar or {}).get("has_solar"))
    existing_inverter_supports_battery = bool((solar or {}).get("battery_ready_inverter"))
    existing_battery_capacity = get_existing_battery_capacity_kwh(solar)
    existing_solar_peak_kwp = get_existing_solar_peak_kwp(solar)
    total_solar_peak_kwp = max(solar_peak_kwp, existing_solar_peak_kwp)
    expand_existing_solar = False
    auto_expansion_target_kwp = estimate_auto_solar_expansion_target_kwp(profile, solar)

    def append_recommendation(
        battery: Dict[str, Any],
        capacity: float,
        simulated_capacity: float,
        inverter: Optional[Dict[str, Any]],
        panel_set: Optional[Dict[str, Any]],
    ) -> None:
        if inverters and not inverter:
            return
        if panels and not panel_set:
            return

        variant_profile = profile_for_panel_set(profile, solar, panel_set)
        result = simulate_capacity(
            capacity_kwh=simulated_capacity,
            load_kwh=variant_profile["load_kwh"],
            pv_kwh=variant_profile["pv_kwh"],
            prices_eur_kwh=prices,
            dod=dod,
            roundtrip_efficiency=roundtrip_efficiency,
            sell_price_eur_kwh=sell_price,
            allow_grid_arbitrage=allow_grid_arbitrage,
        )
        battery_base_price = float(battery.get("pricing", {}).get("unit_price", 0) or 0)
        inverter_base_price = float((inverter or {}).get("pricing", {}).get("unit_price", 0) or 0)
        panels_base_price = float((panel_set or {}).get("total_price_eur", 0) or 0)
        battery_price = apply_margin(battery_base_price, component_margin)
        inverter_price = apply_margin(inverter_base_price, component_margin)
        panels_price = apply_margin(panels_base_price, component_margin)
        hardware_total = battery_price + inverter_price + panels_price
        installation_margin_eur = hardware_total * installation_margin
        capex = hardware_total + installation_margin_eur
        current_bill = base.annual_cost_eur if has_existing_solar else no_system_base.annual_cost_eur
        annual_savings = current_bill - result.annual_cost_eur
        payback = capex / annual_savings if annual_savings > 0 else None
        fit_penalty = abs(simulated_capacity - target) / target

        recommendations.append(
            {
                "system_name": build_system_name(battery, inverter, panel_set),
                "battery": battery,
                "existing_battery": build_existing_battery_info(solar),
                "inverter": inverter,
                "solar_panels": panel_set,
                "existing_inverter_action": build_existing_inverter_action(solar, inverter),
                "replacement_notes": build_replacement_notes(solar, inverter),
                "component_prices_eur": {
                    "battery": round(battery_price, 2),
                    "inverter": round(inverter_price, 2),
                    "solar_panels": round(panels_price, 2),
                    "hardware_total": round(hardware_total, 2),
                    "component_margin_rate": round(component_margin, 2),
                    "component_margin_total": round(
                        (battery_price - battery_base_price)
                        + (inverter_price - inverter_base_price)
                        + (panels_price - panels_base_price),
                        2,
                    ),
                    "base": {
                        "battery": round(battery_base_price, 2),
                        "inverter": round(inverter_base_price, 2),
                        "solar_panels": round(panels_base_price, 2),
                    },
                    "installation_margin": round(installation_margin_eur, 2),
                    "installation_margin_rate": round(installation_margin, 2),
                },
                "capex_total_eur": round(capex, 2),
                "hardware_total_eur": round(hardware_total, 2),
                "installation_margin_eur": round(installation_margin_eur, 2),
                "annual_bill_before_eur": round(current_bill, 2),
                "annual_bill_after_eur": round(result.annual_cost_eur, 2),
                "savings_annual_eur": round(annual_savings, 2),
                "payback_years": round(payback, 1) if payback else None,
                "fit_to_ideal": round(max(0.0, 1.0 - fit_penalty), 2),
                "new_battery_capacity_kwh": round(capacity, 2),
                "simulated_capacity_kwh": round(simulated_capacity, 2),
            }
        )

    for battery in catalog.get("batteries", []):
        specs = battery.get("specs", {})
        capacity = float(specs.get("usable_capacity_kwh") or specs.get("capacity_kwh") or 0)
        if capacity <= 0:
            continue
        simulated_capacity = capacity + existing_battery_capacity
        inverter = (
            build_existing_battery_ready_inverter(solar)
            if has_existing_solar and existing_inverter_supports_battery
            else select_inverter_for_battery(
                battery,
                inverters,
                catalog.get("compatibility"),
                total_solar_peak_kwp,
                requires_pv_input=bool(panels or has_existing_solar),
            )
        )
        if has_existing_solar:
            panel_set = build_existing_solar_panel_set(solar, roof_area_m2)
            if expand_existing_solar:
                additional_target_kwp = max(0.0, total_solar_peak_kwp - existing_solar_peak_kwp)
                existing_panel_area = float(panel_set.get("total_panel_area_m2", 0) or 0)
                additional_panel_set = select_solar_panel_set(
                    panels,
                    battery,
                    inverter,
                    additional_target_kwp,
                    catalog.get("compatibility"),
                    roof_area_m2,
                    existing_peak_kwp=existing_solar_peak_kwp,
                    reserved_roof_area_m2=existing_panel_area,
                )
                if additional_panel_set:
                    panel_set = build_expanded_solar_panel_set(solar, additional_panel_set, roof_area_m2)
        else:
            panel_set = select_solar_panel_set(
                panels,
                battery,
                inverter,
                solar_peak_kwp,
                catalog.get("compatibility"),
                roof_area_m2,
            )
        append_recommendation(battery, capacity, simulated_capacity, inverter, panel_set)

        if has_existing_solar and auto_expansion_target_kwp > existing_solar_peak_kwp and not expand_existing_solar:
            expanded_inverter = (
                build_existing_battery_ready_inverter(solar)
                if existing_inverter_supports_battery
                else select_inverter_for_battery(
                    battery,
                    inverters,
                    catalog.get("compatibility"),
                    auto_expansion_target_kwp,
                    requires_pv_input=bool(panels or has_existing_solar),
                )
            )
            additional_target_kwp = auto_expansion_target_kwp - existing_solar_peak_kwp
            existing_panel_set = build_existing_solar_panel_set(solar, roof_area_m2)
            existing_panel_area = float(existing_panel_set.get("total_panel_area_m2", 0) or 0)
            additional_panel_set = select_solar_panel_set(
                panels,
                battery,
                expanded_inverter,
                additional_target_kwp,
                catalog.get("compatibility"),
                roof_area_m2,
                existing_peak_kwp=existing_solar_peak_kwp,
                reserved_roof_area_m2=existing_panel_area,
                allow_dc_oversize=False,
            )
            if additional_panel_set:
                expanded_panel_set = build_expanded_solar_panel_set(solar, additional_panel_set, roof_area_m2)
                expanded_panel_set["auto_expanded"] = True
                append_recommendation(battery, capacity, simulated_capacity, expanded_inverter, expanded_panel_set)

    return select_budgeted_recommendations(recommendations)


def estimate_auto_solar_expansion_target_kwp(profile: Dict[str, List[float]], solar: Optional[Dict[str, Any]]) -> float:
    if not (solar or {}).get("has_solar"):
        return 0.0
    if (solar or {}).get("battery_ready_inverter"):
        return 0.0
    existing_peak = get_existing_solar_peak_kwp(solar)
    if existing_peak <= 0:
        return 0.0

    annual_load = sum(profile.get("load_kwh", []))
    annual_pv = sum(profile.get("pv_kwh", []))
    if annual_load <= annual_pv * 1.05:
        return 0.0

    yield_kwh_per_kwp = solar_yield_kwh_per_kwp(solar or {"country": "Portugal", "city": "Lisboa"})
    load_matched_peak = annual_load / yield_kwh_per_kwp if yield_kwh_per_kwp > 0 else existing_peak
    target_peak = max(existing_peak + 2.0, load_matched_peak * 1.15)
    return round(min(10.0, target_peak), 2)


def profile_for_panel_set(
    profile: Dict[str, List[float]],
    solar: Optional[Dict[str, Any]],
    panel_set: Optional[Dict[str, Any]],
) -> Dict[str, List[float]]:
    if not panel_set or not panel_set.get("expanded"):
        return profile

    existing_peak = get_existing_solar_peak_kwp(solar)
    total_peak = float(panel_set.get("array_power_kwp", 0) or 0)
    if existing_peak <= 0 or total_peak <= existing_peak:
        return profile

    scale = total_peak / existing_peak
    return {
        "load_kwh": profile["load_kwh"],
        "pv_kwh": [value * scale for value in profile["pv_kwh"]],
    }


def build_system_name(
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    panel_set: Optional[Dict[str, Any]],
) -> str:
    parts = [format_component_name(battery)]
    if inverter:
        parts.append(format_component_name(inverter))
    if panel_set:
        if panel_set.get("expanded"):
            panel = panel_set.get("panel") or {}
            quantity = int(panel_set.get("quantity", 0) or 0)
            panel_name = format_component_name(panel)
            existing_power = panel_set.get("existing_power_kwp", 0)
            if quantity > 0 and panel_name:
                parts.append(f"painéis existentes {existing_power} kWp + {quantity}x {panel_name}")
            else:
                parts.append(f"painéis existentes {panel_set.get('array_power_kwp', 0)} kWp")
        elif panel_set.get("existing"):
            parts.append(f"painéis existentes {panel_set.get('array_power_kwp', 0)} kWp")
        else:
            panel = panel_set.get("panel") or {}
            quantity = int(panel_set.get("quantity", 0) or 0)
            panel_name = format_component_name(panel)
            if quantity > 0 and panel_name:
                parts.append(f"{quantity}x {panel_name}")

    return " + ".join(part for part in parts if part)


def build_replacement_notes(
    solar: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
) -> List[str]:
    if not (solar or {}).get("has_solar"):
        return []
    notes: List[str] = []
    if (solar or {}).get("battery_ready_inverter"):
        notes.append("O inversor atual foi assumido como compatível com bateria e não foi incluído um inversor novo no preço.")
    elif inverter:
        notes.append("O inversor atual não suporta bateria: não será reaproveitado e terá de ser retirado/substituído por este inversor novo.")
    if notes:
        return notes
    if inverter:
        return ["O inversor atual não suporta bateria: não será reaproveitado e terá de ser retirado/substituído por este inversor novo."]
    return []


def build_existing_inverter_action(
    solar: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not (solar or {}).get("has_solar"):
        return None
    if (solar or {}).get("battery_ready_inverter"):
        return "reuse"
    if inverter:
        return "replace"
    return None


def get_existing_battery_capacity_kwh(solar: Optional[Dict[str, Any]]) -> float:
    if not (solar or {}).get("has_solar"):
        return 0.0
    if not (solar or {}).get("battery_ready_inverter"):
        return 0.0
    if not (solar or {}).get("has_battery"):
        return 0.0

    try:
        capacity = float(
            (solar or {}).get("battery_capacity_kwh")
            or (solar or {}).get("existing_battery_capacity_kwh")
            or 0
        )
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, capacity)


def build_existing_battery_info(solar: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    capacity = get_existing_battery_capacity_kwh(solar)
    if capacity <= 0:
        return None
    max_power_kw = safe_positive_float((solar or {}).get("existing_battery_max_power_kw"))
    return {
        "has_battery": True,
        "capacity_kwh": round(capacity, 2),
        "brand": clean_text((solar or {}).get("existing_battery_brand")),
        "model": clean_text((solar or {}).get("existing_battery_model")),
        "max_power_kw": round(max_power_kw, 2) if max_power_kw > 0 else None,
    }


def apply_margin(price: float, margin: float) -> float:
    return price * (1 + margin) if price > 0 else 0.0


def format_component_name(component: Dict[str, Any]) -> str:
    return " ".join(
        str(value).strip()
        for value in [component.get("brand"), component.get("model")]
        if str(value or "").strip()
    )


def build_existing_battery_ready_inverter(solar: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    peak_kw = max(0.0, float((solar or {}).get("peak_kw", 0) or 0))
    max_power_kw = safe_positive_float((solar or {}).get("existing_inverter_max_power_kw")) or peak_kw
    brand = clean_text((solar or {}).get("existing_inverter_brand")) or "Inversor atual"
    model = clean_text((solar or {}).get("existing_inverter_model")) or "compatível com bateria"
    return {
        "id": "existing-battery-ready-inverter",
        "brand": brand,
        "model": model,
        "specs": {
            "power_kw": max_power_kw,
            "is_hybrid": True,
            "connection": "existing_system",
        },
        "pricing": {
            "unit_price": 0,
            "currency": "EUR",
        },
        "links": {
            "url": "",
        },
        "existing": True,
    }


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def safe_positive_float(value: Any) -> float:
    try:
        return max(0.0, float(value or 0))
    except (TypeError, ValueError):
        return 0.0


def build_existing_solar_panel_set(solar: Optional[Dict[str, Any]], roof_area_m2: Optional[float] = None) -> Dict[str, Any]:
    peak_kw = max(0.0, float((solar or {}).get("peak_kw", 0) or 0))
    estimated_panel_count = ceil((peak_kw * 1000) / 440) if peak_kw > 0 else 0
    total_panel_area = estimated_panel_count * DEFAULT_PANEL_AREA_M2
    roof_coverage_pct = (total_panel_area / roof_area_m2 * 100) if roof_area_m2 and roof_area_m2 > 0 else None
    return {
        "existing": True,
        "panel": {
            "id": "existing-solar-panels",
            "brand": "Painéis existentes",
            "model": "",
            "specs": {
                "power_w": None,
            },
            "pricing": {
                "unit_price": 0,
                "currency": "EUR",
            },
            "links": {
                "url": "",
            },
        },
        "quantity": 0,
        "array_power_kwp": round(peak_kw, 2),
        "total_price_eur": 0,
        "roof_area_m2": round(roof_area_m2, 1) if roof_area_m2 else None,
        "total_panel_area_m2": round(total_panel_area, 1) if total_panel_area else None,
        "roof_coverage_pct": round(roof_coverage_pct, 1) if roof_coverage_pct is not None else None,
    }


def build_expanded_solar_panel_set(
    solar: Optional[Dict[str, Any]],
    additional_set: Dict[str, Any],
    roof_area_m2: Optional[float] = None,
) -> Dict[str, Any]:
    existing_set = build_existing_solar_panel_set(solar, roof_area_m2)
    existing_power = float(existing_set.get("array_power_kwp", 0) or 0)
    added_power = float(additional_set.get("array_power_kwp", 0) or 0)
    existing_area = float(existing_set.get("total_panel_area_m2", 0) or 0)
    added_area = float(additional_set.get("total_panel_area_m2", 0) or 0)
    total_area = existing_area + added_area
    roof_coverage_pct = (total_area / roof_area_m2 * 100) if roof_area_m2 and roof_area_m2 > 0 else None

    return {
        **additional_set,
        "existing": True,
        "expanded": True,
        "existing_power_kwp": round(existing_power, 2),
        "added_power_kwp": round(added_power, 2),
        "array_power_kwp": round(existing_power + added_power, 2),
        "existing_panel_set": existing_set,
        "additional_panel_set": additional_set,
        "roof_area_m2": round(roof_area_m2, 1) if roof_area_m2 else additional_set.get("roof_area_m2"),
        "total_panel_area_m2": round(total_area, 1) if total_area else additional_set.get("total_panel_area_m2"),
        "roof_coverage_pct": round(roof_coverage_pct, 1) if roof_coverage_pct is not None else additional_set.get("roof_coverage_pct"),
    }


def select_budgeted_recommendations(recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not recommendations:
        return []

    tier_labels = {
        "budget": "Budget",
        "balanced": "Balanced",
        "premium": "Premium",
    }
    sorted_by_price = sorted(recommendations, key=lambda item: item["capex_total_eur"])
    total = len(sorted_by_price)

    for index, item in enumerate(sorted_by_price):
        if index < total / 3:
            tier = "budget"
        elif index < (total * 2) / 3:
            tier = "balanced"
        else:
            tier = "premium"
        item["budget_tier"] = tier
        item["budget_label"] = tier_labels[tier]

    def quality_score(item: Dict[str, Any]) -> tuple:
        return (
            -item["fit_to_ideal"],
            item["payback_years"] if item["payback_years"] is not None else 999,
            item["capex_total_eur"],
        )

    def capacity_score(item: Dict[str, Any]) -> tuple:
        return (
            -float(item.get("simulated_capacity_kwh", 0) or 0),
            item["payback_years"] if item["payback_years"] is not None else 999,
            item["capex_total_eur"],
        )

    selected: List[Dict[str, Any]] = []
    selected_ids: set[str] = set()
    for tier in ("budget", "balanced", "premium"):
        tier_items = [item for item in sorted_by_price if item["budget_tier"] == tier]
        if tier == "budget":
            non_auto_items = [
                item for item in tier_items
                if not (item.get("solar_panels") or {}).get("auto_expanded")
            ]
            if non_auto_items:
                tier_items = non_auto_items
        candidates = sorted(tier_items, key=quality_score)[:2]
        if tier == "premium" and tier_items:
            largest = sorted(tier_items, key=capacity_score)[0]
            if largest not in candidates:
                candidates = candidates[:1] + [largest]
        for item in candidates:
            battery_id = str(item.get("battery", {}).get("id", ""))
            if battery_id in selected_ids:
                continue
            selected.append(item)
            selected_ids.add(battery_id)

    if len(selected) < 6:
        for item in sorted(recommendations, key=quality_score):
            battery_id = str(item.get("battery", {}).get("id", ""))
            if battery_id in selected_ids:
                continue
            if item.get("budget_tier") == "budget" and (item.get("solar_panels") or {}).get("auto_expanded"):
                continue
            selected.append(item)
            selected_ids.add(battery_id)
            if len(selected) == 6:
                break

    tier_order = {"budget": 0, "balanced": 1, "premium": 2}
    return sorted(
        selected[:6],
        key=lambda item: (
            tier_order.get(item.get("budget_tier", ""), 99),
            quality_score(item),
        ),
    )


def select_solar_panel_set(
    panels: List[Dict[str, Any]],
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    target_peak_kwp: float,
    compatibility: Optional[Dict[str, Any]] = None,
    roof_area_m2: Optional[float] = None,
    existing_peak_kwp: float = 0.0,
    reserved_roof_area_m2: float = 0.0,
    allow_dc_oversize: bool = True,
) -> Optional[Dict[str, Any]]:
    if not panels or target_peak_kwp <= 0:
        return None

    compatible_panels = [
        panel for panel in panels
        if is_component_set_compatible(battery, inverter, panel, compatibility)
    ]
    if not compatible_panels:
        return None

    inverter_specs = (inverter or {}).get("specs", {})
    max_pv_input_kwp = float(inverter_specs.get("max_pv_input_kwp", 0) or 0)
    inverter_power = get_inverter_power_kw(inverter)

    target_kwp = target_peak_kwp
    if inverter_power > 0:
        inverter_target = inverter_power * (1.35 if allow_dc_oversize else 1.0)
        target_kwp = max(target_kwp, inverter_target - existing_peak_kwp)
    if max_pv_input_kwp > 0:
        remaining_pv_input = max(0.0, max_pv_input_kwp - existing_peak_kwp)
        target_kwp = min(target_kwp, remaining_pv_input)
    elif inverter_power > 0:
        inverter_limit = inverter_power * (1.35 if allow_dc_oversize else 1.0)
        target_kwp = min(target_kwp, max(0.0, inverter_limit - existing_peak_kwp))
    if inverter_power > 0 and not allow_dc_oversize:
        target_kwp = min(target_kwp, max(0.0, inverter_power - existing_peak_kwp))

    if target_kwp <= 0:
        return None

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

    panel_area_m2 = get_panel_area_m2(panel)
    quantity = max(1, ceil((target_kwp * 1000) / power_w))
    max_quantities = []
    if max_pv_input_kwp > 0:
        max_quantities.append(max(1, int((max_pv_input_kwp * 1000) // power_w)))
    rule_max = get_inverter_panel_max_count(inverter, panel, compatibility)
    if rule_max:
        max_quantities.append(rule_max)
    if roof_area_m2 and roof_area_m2 > 0:
        usable_roof_area = max(0.0, roof_area_m2 * DEFAULT_USABLE_ROOF_RATIO - reserved_roof_area_m2)
        if usable_roof_area <= 0:
            return None
        max_panels_by_roof = int(usable_roof_area // panel_area_m2)
        if max_panels_by_roof <= 0:
            return None
        max_quantities.append(max_panels_by_roof)

    if max_quantities:
        quantity = min(quantity, min(max_quantities))

    array_power_kwp = quantity * power_w / 1000
    total_panel_area_m2 = quantity * panel_area_m2
    roof_coverage_pct = (total_panel_area_m2 / roof_area_m2 * 100) if roof_area_m2 and roof_area_m2 > 0 else None

    return {
        "panel": panel,
        "quantity": quantity,
        "array_power_kwp": round(array_power_kwp, 2),
        "total_price_eur": round(quantity * unit_price, 2),
        "panel_area_m2": round(panel_area_m2, 2),
        "total_panel_area_m2": round(total_panel_area_m2, 1),
        "roof_area_m2": round(roof_area_m2, 1) if roof_area_m2 else None,
        "usable_roof_area_m2": round(max(0.0, roof_area_m2 * DEFAULT_USABLE_ROOF_RATIO - reserved_roof_area_m2), 1) if roof_area_m2 else None,
        "roof_coverage_pct": round(roof_coverage_pct, 1) if roof_coverage_pct is not None else None,
        "max_panels_by_roof": int(max(0.0, roof_area_m2 * DEFAULT_USABLE_ROOF_RATIO - reserved_roof_area_m2) // panel_area_m2) if roof_area_m2 and roof_area_m2 > 0 else None,
    }


def select_inverter_for_battery(
    battery: Dict[str, Any],
    inverters: List[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]] = None,
    pv_peak_kwp: float = 0.0,
    requires_pv_input: bool = False,
) -> Optional[Dict[str, Any]]:
    if not inverters:
        return None

    battery_power = float(battery.get("specs", {}).get("power_kw", 0) or 0)
    battery_brand = str(battery.get("brand", "")).lower()
    compatible_inverters = [
        inverter for inverter in inverters
        if is_component_set_compatible(battery, inverter, None, compatibility)
        and is_inverter_sized_for_battery(battery, inverter)
    ]
    if requires_pv_input:
        pv_capable_inverters = []
        for inverter in compatible_inverters:
            specs = inverter.get("specs", {})
            max_pv_input_kwp = float(specs.get("max_pv_input_kwp", 0) or 0)
            if not (specs.get("has_direct_pv_input") or max_pv_input_kwp > 0):
                continue
            if pv_peak_kwp > 0 and max_pv_input_kwp > 0 and max_pv_input_kwp < pv_peak_kwp:
                continue
            pv_capable_inverters.append(inverter)
        compatible_inverters = pv_capable_inverters
    if not compatible_inverters:
        return None

    def score(inverter: Dict[str, Any]) -> tuple:
        specs = inverter.get("specs", {})
        inverter_power = get_inverter_power_kw(inverter)
        power_gap = abs(inverter_power - battery_power) if battery_power > 0 else 0
        undersized_penalty = 10 if battery_power > 0 and inverter_power < battery_power * 0.75 else 0
        pv_oversized_penalty = 0
        if pv_peak_kwp > 0 and inverter_power > pv_peak_kwp * 1.5:
            pv_oversized_penalty = inverter_power - pv_peak_kwp * 1.5
        hybrid_bonus = -1 if specs.get("is_hybrid") else 0

        compatible_brands = [str(brand).lower() for brand in specs.get("compatible_battery_brands", [])]
        brand_penalty = 0
        if compatible_brands and battery_brand not in compatible_brands:
            brand_penalty = 20

        price = float(inverter.get("pricing", {}).get("unit_price", 0) or 0)
        return (brand_penalty, undersized_penalty, pv_oversized_penalty, power_gap, hybrid_bonus, price)

    return min(compatible_inverters, key=score)


def is_inverter_sized_for_battery(battery: Dict[str, Any], inverter: Dict[str, Any]) -> bool:
    specs = battery.get("specs", {})
    battery_capacity = float(specs.get("usable_capacity_kwh") or specs.get("capacity_kwh") or 0)
    battery_power = float(battery.get("specs", {}).get("power_kw", 0) or 0)
    inverter_power = get_inverter_power_kw(inverter)
    if inverter_power <= 0:
        return True
    minimum_by_power = battery_power * 0.75 if battery_power > 0 else 0.0
    minimum_by_capacity = battery_capacity * 0.35 if battery_capacity > 0 else 0.0
    return inverter_power >= max(minimum_by_power, minimum_by_capacity)


def get_inverter_power_kw(inverter: Optional[Dict[str, Any]]) -> float:
    specs = (inverter or {}).get("specs", {})
    return float(
        specs.get("power_kw")
        or specs.get("rated_output_power_kw")
        or specs.get("max_battery_charge_discharge_kw")
        or 0
    )


def get_panel_area_m2(panel: Dict[str, Any]) -> float:
    dimensions = panel.get("specs", {}).get("dimensions_mm", {})
    length = float(dimensions.get("length") or 0)
    width = float(dimensions.get("width") or 0)
    if length > 0 and width > 0:
        return (length * width) / 1_000_000
    return DEFAULT_PANEL_AREA_M2


def get_inverter_panel_max_count(
    inverter: Optional[Dict[str, Any]],
    panel: Dict[str, Any],
    compatibility: Optional[Dict[str, Any]],
) -> Optional[int]:
    if not inverter or not compatibility:
        return None
    inverter_id = inverter.get("id")
    panel_id = panel.get("id")
    rules = [
        rule for rule in compatibility.get("inverter_solar_panel_rules", [])
        if rule.get("inverter_id") == inverter_id
        and rule.get("solar_panel_id") in (panel_id, None)
        and bool(rule.get("compatible"))
    ]
    exact_rules = [rule for rule in rules if rule.get("solar_panel_id") == panel_id]
    selected = exact_rules or rules
    limits = [
        int(rule.get("max_panel_count_by_power_only"))
        for rule in selected
        if rule.get("max_panel_count_by_power_only")
    ]
    return min(limits) if limits else None


def is_component_set_compatible(
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    solar_panel: Optional[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]],
) -> bool:
    if not compatibility:
        return True

    if "group_members" in compatibility or "inverter_solar_panel_rules" in compatibility:
        battery_inverter_ok = is_battery_inverter_compatible_from_sqlite(battery, inverter, compatibility)
        if not battery_inverter_ok:
            return False
        if solar_panel is None:
            return True
        return is_inverter_panel_compatible_from_sqlite(inverter, solar_panel, compatibility)

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


def is_battery_inverter_compatible_from_sqlite(
    battery: Dict[str, Any],
    inverter: Optional[Dict[str, Any]],
    compatibility: Dict[str, Any],
) -> bool:
    if not inverter:
        return False
    if inverter.get("existing"):
        return True

    default = bool(compatibility.get("default_compatible", False))
    matched_rules = [
        rule for rule in compatibility.get("rules", [])
        if rule_applies_to_components(rule, battery, inverter, compatibility)
    ]
    if not matched_rules:
        return default

    # Blocking/not-verified rules are safety critical and override allows.
    for rule in matched_rules:
        if not bool(rule.get("compatible")):
            return False

    return any(bool(rule.get("compatible")) for rule in matched_rules)


def is_inverter_panel_compatible_from_sqlite(
    inverter: Optional[Dict[str, Any]],
    solar_panel: Optional[Dict[str, Any]],
    compatibility: Dict[str, Any],
) -> bool:
    if not inverter or not solar_panel:
        return False
    if inverter.get("existing") or solar_panel.get("existing"):
        return True

    inverter_id = inverter.get("id")
    panel_id = solar_panel.get("id")
    matching_rules = [
        rule for rule in compatibility.get("inverter_solar_panel_rules", [])
        if rule.get("inverter_id") == inverter_id
        and rule.get("solar_panel_id") in (panel_id, None)
    ]
    if not matching_rules:
        return bool(compatibility.get("default_compatible", False))

    exact_panel_rules = [rule for rule in matching_rules if rule.get("solar_panel_id") == panel_id]
    selected_rules = exact_panel_rules or matching_rules
    return any(bool(rule.get("compatible")) for rule in selected_rules)


def rule_applies_to_components(
    rule: Dict[str, Any],
    battery: Dict[str, Any],
    inverter: Dict[str, Any],
    compatibility: Dict[str, Any],
) -> bool:
    if not role_constraints_match(rule, "battery", "battery", battery, compatibility):
        return False
    if not role_constraints_match(rule, "inverter", "inverter", inverter, compatibility):
        return False
    return rule_conditions_match(rule, battery, inverter, compatibility)


def role_constraints_match(
    rule: Dict[str, Any],
    role: str,
    component_type: str,
    component: Dict[str, Any],
    compatibility: Dict[str, Any],
) -> bool:
    direct_constraints = [
        item for item in rule.get("components", {}).get(role, [])
        if item.get("component_type") == component_type
    ]
    group_constraints = [
        item for item in rule.get("groups", {}).get(role, [])
        if item.get("component_type") == component_type
    ]

    if not direct_constraints and not group_constraints:
        return True

    component_id = component.get("id")
    if any(item.get("component_id") == component_id for item in direct_constraints):
        return True

    component_groups = set(
        compatibility.get("group_members", {})
        .get(component_type, {})
        .get(component_id, [])
    )
    return any(item.get("group_id") in component_groups for item in group_constraints)


def rule_conditions_match(
    rule: Dict[str, Any],
    battery: Dict[str, Any],
    inverter: Dict[str, Any],
    compatibility: Dict[str, Any],
) -> bool:
    for condition in rule.get("conditions", []):
        key = condition.get("key")
        value = condition.get("value")
        if key == "applies_to_battery_group":
            if value not in get_component_groups("battery", battery, compatibility):
                return False
        elif key == "applies_to_inverter_group":
            if value not in get_component_groups("inverter", inverter, compatibility):
                return False
        elif key == "applies_when":
            if not isinstance(value, dict):
                return False
            battery_type = normalize_voltage_class(
                battery.get("specs", {}).get("battery_type")
                or battery.get("specs", {}).get("nominal_voltage_class")
            )
            inverter_type = normalize_voltage_class(
                inverter.get("specs", {}).get("battery_type")
                or inverter.get("specs", {}).get("battery_technology")
            )
            expected_battery_type = normalize_voltage_class(value.get("battery_type"))
            expected_inverter_type = normalize_voltage_class(value.get("inverter_battery_technology"))
            if expected_battery_type and battery_type != expected_battery_type:
                return False
            if expected_inverter_type and inverter_type != expected_inverter_type:
                return False
    return True


def get_component_groups(component_type: str, component: Dict[str, Any], compatibility: Dict[str, Any]) -> set:
    return set(
        compatibility.get("group_members", {})
        .get(component_type, {})
        .get(component.get("id"), [])
    )


def normalize_voltage_class(value: Any) -> str:
    text = str(value or "").lower()
    if "high" in text:
        return "high_voltage"
    if "low" in text or "48" in text:
        return "low_voltage"
    return text


def should_allow_grid_arbitrage(tariff: Dict[str, Any]) -> bool:
    tariff_type = tariff.get("type", "simple")
    if tariff_type == "simple":
        return False

    prices = tariff.get("prices") or {}
    active_periods = active_tariff_periods(tariff_type)
    used_prices = [float(prices.get(period, 0) or 0) for period in active_periods if float(prices.get(period, 0) or 0) > 0]
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

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .constants import (
    DEFAULT_EV_CONSUMPTION_KWH_PER_KM,
    MONTH_DAYS,
    MONTH_LOAD_FACTORS,
    MONTH_SOLAR_FACTORS,
    RESIDENTIAL_HOURLY_SHAPE,
)
from .tariffs import tariff_period


def build_hourly_profile(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    solar: Dict[str, Any],
) -> Tuple[Dict[str, List[float]], Dict[str, float]]:
    """Create one synthetic hourly year of load and PV production.

    The simulator does not receive meter data hour by hour. This function turns
    house/bill inputs into representative monthly totals, then distributes those
    totals with residential hourly shapes and seasonal solar factors.
    """

    monthly_consumption = estimate_monthly_consumption(
        mode, input_data, tariff, include_ev=False)
    monthly_solar = estimate_monthly_solar(input_data, solar)

    load: List[float] = []
    pv: List[float] = []
    tariff_type = tariff.get("type", "simple")

    for month_index, days in enumerate(MONTH_DAYS):
        period_weights = {"simple": 0.0,
                          "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}
        solar_weights = [0.0 for _ in range(days * 24)]

        for day in range(days):
            for hour in range(24):
                period = tariff_period(hour, tariff_type)
                weight = RESIDENTIAL_HOURLY_SHAPE[hour] * \
                    MONTH_LOAD_FACTORS[month_index]
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
                weight = RESIDENTIAL_HOURLY_SHAPE[hour] * \
                    MONTH_LOAD_FACTORS[month_index]
                divisor = period_weights[period] or 1.0
                month_load.append(target_kwh * weight / divisor)

        month_ev_load = estimate_monthly_ev_hourly_load(input_data, days)
        if month_ev_load:
            month_load = [base + ev for base,
                          ev in zip(month_load, month_ev_load)]

        month_solar_total = monthly_solar[month_index]
        solar_divisor = sum(solar_weights) or 1.0
        month_pv = [month_solar_total * weight /
                    solar_divisor for weight in solar_weights]

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
    """Estimate monthly kWh by tariff period from house details or bill history."""

    tariff_type = tariff.get("type", "simple")
    monthly_ev_by_period = estimate_monthly_ev_consumption_by_period(
        input_data, tariff_type) if include_ev else {}

    if mode == "house":
        occupants = max(1, int(float(input_data.get("occupants", 1))))
        area_m2 = max(20.0, float(input_data.get("area_m2", 80)))
        floors = max(1, int(float(input_data.get("floors", 1))))
        annual = 1200 + occupants * 850 + \
            max(0.0, area_m2 - 60) * 6 + (floors - 1) * 250
        monthly = annual / 12
        return add_ev_to_monthly_consumption(split_monthly_total(monthly, tariff_type), monthly_ev_by_period)

    history = input_data.get("history") or []
    months = max(
        1, int(float(input_data.get("historyMonths", len(history) or 1))))
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
            monthly_avg = sum(float(value or 0)
                              for value in consumption.values())
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
            float(vehicle.get("consumption_kwh_per_km", DEFAULT_EV_CONSUMPTION_KWH_PER_KM)
                  or DEFAULT_EV_CONSUMPTION_KWH_PER_KM),
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
            float(vehicle.get("consumption_kwh_per_km", DEFAULT_EV_CONSUMPTION_KWH_PER_KM)
                  or DEFAULT_EV_CONSUMPTION_KWH_PER_KM),
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
    """Estimate monthly PV production from user history or local annual yield."""

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
    """Return existing PV size or a conservative new PV target in kWp."""

    existing_peak = get_existing_solar_peak_kwp(solar)
    if solar.get("has_solar") and existing_peak > 0:
        return round(existing_peak, 2)

    annual_consumption = profile_summary["annual_consumption_kwh"]
    target_peak = annual_consumption / \
        solar_yield_kwh_per_kwp(
            solar or {"country": "Portugal", "city": "Lisboa"})
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

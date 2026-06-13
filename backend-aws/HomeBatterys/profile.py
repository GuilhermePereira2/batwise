from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta

import json
import os
from .constants import (
    DEFAULT_EV_CONSUMPTION_KWH_PER_KM,
    MONTH_DAYS,
    MONTH_LOAD_FACTORS,
    MONTH_SOLAR_FACTORS,
    RESIDENTIAL_HOURLY_SHAPE,
)
from .tariffs import tariff_period

# Load realistic consumption coefficients
PROFILE_DATA = None
try:
    _json_path = os.path.join(os.path.dirname(__file__), "..", "data", "consumption_profiles.json")
    if os.path.exists(_json_path):
        with open(_json_path, "r") as f:
            PROFILE_DATA = json.load(f)
except Exception as e:
    print(f"Warning: Could not load consumption profiles: {e}")

def generate_estimated_profile(area: float, people: int, floors: int, ev_count: int = 0, daily_kms: float = 0.0, charge_time: str = "night") -> List[float]:
    """Generate a realistic 8760h hourly profile based on house characteristics."""
    if not PROFILE_DATA:
        # Fallback to a synthetic but reasonable profile if data is missing
        annual_total = 1200 + people * 850 + max(0.0, area - 60) * 6 + (floors - 1) * 250
        hourly = []
        for i in range(8760):
            month_idx = (datetime(2023, 1, 1) + timedelta(hours=i)).month - 1
            hour = i % 24
            val = (annual_total / 8760) * RESIDENTIAL_HOURLY_SHAPE[hour] * MONTH_LOAD_FACTORS[month_idx]
            hourly.append(val)
    else:
        slopes = PROFILE_DATA["slopes"]
        intercepts = PROFILE_DATA["intercepts_0p"]
        person_factor = PROFILE_DATA["person_hourly_factor"]
        floor_factor = PROFILE_DATA.get("floor_factor_kw", 0.028)
        
        hourly = []
        dt = datetime(2023, 1, 1)
        for i in range(8760):
            m = dt.month - 1
            h = dt.hour
            # House base + area scaling
            load = slopes[m][h] * area + intercepts[m][h]
            # People scaling
            load += people * person_factor[h]
            # Floor scaling
            if floors > 1:
                load += (floors - 1) * floor_factor
            
            hourly.append(max(0.05, load))
            dt += timedelta(hours=1)

    # Add EV load if present
    if ev_count > 0 and daily_kms > 0:
        ev_daily_kwh = ev_count * daily_kms * 0.18
        if charge_time == "varying":
            ev_hourly = ev_daily_kwh / 12.0 # Distributed over 12 hours
            for i in range(8760):
                hour = i % 24
                if 8 <= hour < 20:
                    hourly[i] += ev_hourly
        else:
            ev_hourly = ev_daily_kwh / 7.0 # Distributed over 7 hours
            for i in range(8760):
                hour = i % 24
                if charge_time == "night":
                    if 0 <= hour < 7:
                        hourly[i] += ev_hourly
                elif charge_time == "day":
                    if 10 <= hour < 17:
                        hourly[i] += ev_hourly
                    
    return hourly

def build_hourly_profile(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    solar: Dict[str, Any],
) -> Tuple[Dict[str, List[float]], Dict[str, float]]:
    """Create one synthetic hourly year of load and PV production."""

    if mode == "eredes" and "csv_profile" in input_data:
        # ... (keep existing eredes logic)
        csv_profile = input_data["csv_profile"]
        import_kwh = csv_profile.get("load_kwh", [0.0] * 8760)
        export_kwh = csv_profile.get("pv_kwh", [0.0] * 8760)
        import_kwh = (import_kwh + [0.0] * 8760)[:8760]
        export_kwh = (export_kwh + [0.0] * 8760)[:8760]
        existing_peak = get_existing_solar_peak_kwp(solar)
        load = []
        pv = []
        if solar.get("has_solar") and existing_peak > 0:
            annual_yield = existing_peak * solar_yield_kwh_per_kwp(solar)
            factor_sum = sum(MONTH_SOLAR_FACTORS)
            monthly_production = [annual_yield * f / factor_sum for f in MONTH_SOLAR_FACTORS]
            solar_shape_sum = sum(solar_hour_weight(h) for h in range(24))
            for i in range(8760):
                month_idx = (datetime(2023, 1, 1) + timedelta(hours=i)).month - 1
                hour = i % 24
                prod_hour = (monthly_production[month_idx] * solar_hour_weight(hour) / 
                             (solar_shape_sum or 1.0) / 30.4)
                real_export = export_kwh[i]
                pv_hour = max(prod_hour, real_export)
                self_consumption = max(0.0, pv_hour - real_export)
                load_hour = import_kwh[i] + self_consumption
                load.append(round(load_hour, 4))
                pv.append(round(pv_hour, 4))
        else:
            load = import_kwh
            pv = [0.0] * 8760
        return ({"load_kwh": load, "pv_kwh": pv}, {"annual_consumption_kwh": sum(load), "annual_solar_kwh": sum(pv), "annual_ev_consumption_kwh": estimate_monthly_ev_consumption(input_data) * 12})

    # Mode house or bill
    site = input_data.get("site") or {}
    area = float(input_data.get("area_m2", site.get("area_m2", 100)))
    people = int(input_data.get("occupants", site.get("occupants", 3)))
    floors = int(input_data.get("floors", site.get("floors", 1)))
    
    ev_data = input_data.get("electric_vehicles") or {}
    ev_count = int(ev_data.get("count", 0))
    # Get daily kms from the first vehicle as a representative value
    vehicles = ev_data.get("vehicles") or []
    daily_kms = 0.0
    charge_time = "night"
    if vehicles and isinstance(vehicles[0], dict):
        daily_kms = float(vehicles[0].get("daily_km", 0))
        charge_time = str(vehicles[0].get("charging_schedule", "night"))

    if mode == "house":
        load = generate_estimated_profile(area, people, floors, ev_count, daily_kms, charge_time)
        # PV part
        monthly_solar = estimate_monthly_solar(input_data, solar)
        pv = []
        for month_index, days in enumerate(MONTH_DAYS):
            solar_weights = [solar_hour_weight(h % 24) for h in range(days * 24)]
            solar_total = monthly_solar[month_index]
            solar_divisor = sum(solar_weights) or 1.0
            pv.extend([solar_total * w / solar_divisor for w in solar_weights])
        
        return ({"load_kwh": load, "pv_kwh": pv}, {"annual_consumption_kwh": sum(load), "annual_solar_kwh": sum(pv), "annual_ev_consumption_kwh": ev_count * daily_kms * 0.18 * 365})

    # Mode Bill: respects monthly totals but uses realistic shape
    monthly_consumption = estimate_monthly_consumption(mode, input_data, tariff, include_ev=False)
    monthly_solar = estimate_monthly_solar(input_data, solar)
    realistic_base = generate_estimated_profile(area, people, floors, 0, 0) # Base shape only
    
    load = []
    pv = []
    tariff_type = tariff.get("type", "simple")
    
    cursor = 0
    for month_index, days in enumerate(MONTH_DAYS):
        month_realistic = realistic_base[cursor:cursor + days*24]
        cursor += days * 24
        
        # Split monthly target into periods
        period_weights = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}
        for i, val in enumerate(month_realistic):
            period = tariff_period(i % 24, tariff_type)
            period_weights[period] += val
            
        month_load = []
        for i, val in enumerate(month_realistic):
            period = tariff_period(i % 24, tariff_type)
            target_kwh = monthly_consumption.get(period, 0.0)
            divisor = period_weights[period] or 1.0
            month_load.append(target_kwh * val / divisor)
            
        # Add EV load
        ev_load = estimate_monthly_ev_hourly_load(input_data, days)
        month_load = [l + ev for l, ev in zip(month_load, ev_load)]
        
        # PV
        solar_weights = [solar_hour_weight(h % 24) for h in range(days * 24)]
        solar_total = monthly_solar[month_index]
        solar_divisor = sum(solar_weights) or 1.0
        month_pv = [solar_total * w / solar_divisor for w in solar_weights]
        
        load.extend(month_load)
        pv.extend(month_pv)

    return ({"load_kwh": load, "pv_kwh": pv}, {"annual_consumption_kwh": sum(load), "annual_solar_kwh": sum(pv), "annual_ev_consumption_kwh": estimate_monthly_ev_consumption(input_data) * 12})


def estimate_monthly_consumption(
    mode: str,
    input_data: Dict[str, Any],
    tariff: Dict[str, Any],
    include_ev: bool = True,
) -> Dict[str, float]:
    """Estimate monthly kWh by tariff period from house details or bill history."""

    tariff_type = tariff.get("type", "simple")
    
    site = input_data.get("site") or {}
    area = float(input_data.get("area_m2", site.get("area_m2", 100)))
    people = int(input_data.get("occupants", site.get("occupants", 3)))
    floors = int(input_data.get("floors", site.get("floors", 1)))
    
    ev_data = input_data.get("electric_vehicles") or {}
    ev_count = int(ev_data.get("count", 0)) if include_ev else 0
    vehicles = ev_data.get("vehicles") or []
    daily_kms = 0.0
    charge_time = "night"
    if vehicles and isinstance(vehicles[0], dict):
        daily_kms = float(vehicles[0].get("daily_km", 0))
        charge_time = str(vehicles[0].get("charging_schedule", "night"))

    if mode == "house":
        profile = generate_estimated_profile(area, people, floors, ev_count, daily_kms, charge_time)
        # Sum by month and period (approximate monthly by dividing annual by 12)
        annual_by_period = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}
        for i, val in enumerate(profile):
            period = tariff_period(i % 24, tariff_type)
            annual_by_period[period] += val
        return {k: v / 12 for k, v in annual_by_period.items()}

    # Bill mode: prioritize history, then monthly_avg, then house estimate
    history = input_data.get("history") or []
    months = max(1, int(float(input_data.get("historyMonths", len(history) or 1))))
    period_totals = {"simple": 0.0, "offPeak": 0.0, "peak": 0.0, "ponta": 0.0}

    has_history_data = False
    for entry in history[:months]:
        if not isinstance(entry, dict):
            val = float(entry or 0)
            if val > 0:
                period_totals["simple"] += val
                has_history_data = True
            continue
        
        for key in ["simple", "offPeak", "peak", "ponta"]:
            val = float(entry.get(key, 0) or 0)
            if val > 0:
                period_totals[key] += val
                has_history_data = True

    if not has_history_data:
        monthly_avg = float(input_data.get("monthly_avg", 0) or 0)
        if monthly_avg <= 0:
            consumption = input_data.get("consumption") or {}
            monthly_avg = sum(float(value or 0) for value in consumption.values())
        
        if monthly_avg <= 0:
            # Fallback to the new realistic house estimate
            return estimate_monthly_consumption("house", input_data, tariff, include_ev)
            
        return add_ev_to_monthly_consumption(split_monthly_total(monthly_avg, tariff_type), 
                                           estimate_monthly_ev_consumption_by_period(input_data, tariff_type) if include_ev else {})

    return add_ev_to_monthly_consumption({key: value / months for key, value in period_totals.items()}, 
                                       estimate_monthly_ev_consumption_by_period(input_data, tariff_type) if include_ev else {})

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
    varying_hours = list(range(8, 20)) # 8:00 to 20:00

    if schedule == "day":
        return {hour: 1 / len(day_hours) for hour in day_hours}
    if schedule == "varying":
        return {hour: 1 / len(varying_hours) for hour in varying_hours}
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
    if schedule == "varying":
        # Approximate for bi-horário (peak is usually 8-22 or similar)
        return {"peak": 0.8, "offPeak": 0.2}
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

def estimate_roof_area_m2(input_data: Dict[str, Any], solar: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """Determine the usable roof area for panels.
    
    Priority:
    1. If map is enabled and has a polygon/area, use it.
    2. If panel_area is explicitly provided in solar, use it.
    3. Fallback to house area (area_m2).
    """
    if solar:
        roof_mapping = solar.get("roof_mapping") or {}
        if roof_mapping.get("enabled") and roof_mapping.get("area_m2", 0) > 0:
            return float(roof_mapping["area_m2"])
            
        if solar.get("panel_area"):
            return max(0.0, float(solar.get("panel_area") or 0))

    if input_data.get("roof_area_m2") is not None:
        return max(0.0, float(input_data.get("roof_area_m2") or 0))

    site = input_data.get("site") or {}
    area_m2 = input_data.get("area_m2", site.get("area_m2"))
    if area_m2 is None:
        return None

    return max(0.0, float(area_m2 or 0))

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
    
    # If user already has solar, only recommend expanding if they explicitly asked for it
    if solar.get("has_solar") and existing_peak > 0:
        if not solar.get("expand_solar"):
            return round(existing_peak, 2)
        
        # If they want to expand, but current load is small, still offer a minimum expansion
        # to ensure new hybrid inverters can reach minimum MPPT voltage.
        # (e.g. at least 3-4 kWp total is safer for most single-phase hybrids)
        annual_consumption = profile_summary["annual_consumption_kwh"]
        yield_val = solar_yield_kwh_per_kwp(solar)
        ideal_target = annual_consumption / yield_val if yield_val > 0 else existing_peak
        
        # Minimum safe total for hybrid inverters is around 2.5 - 3.0 kWp
        # If user explicitly asked for expansion, we ensure we reach at least this safe floor.
        safe_technical_floor = 2.64 # ~6 panels of 440W
        
        return round(max(existing_peak, ideal_target, safe_technical_floor), 2)

    annual_consumption = profile_summary["annual_consumption_kwh"]
    target_peak = annual_consumption / \
        solar_yield_kwh_per_kwp(
            solar or {"country": "Portugal", "city": "Lisboa"})
    return round(max(2.0, min(25.0, target_peak)), 2)

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
    # Adjusted for Portugal (WET/WEST), centered around 13:00-14:00
    weights = {
        6: 0.02,
        7: 0.08,
        8: 0.25,
        9: 0.50,
        10: 0.75,
        11: 0.92,
        12: 1.00,
        13: 1.00,
        14: 0.95,
        15: 0.80,
        16: 0.55,
        17: 0.30,
        18: 0.12,
        19: 0.03,
    }
    return weights.get(hour, 0.0)

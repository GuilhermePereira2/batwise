from __future__ import annotations

from typing import Any, Dict, List

from .constants import MONTH_DAYS


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

def build_hourly_prices(tariff: Dict[str, Any]) -> List[float]:
    """Expand the tariff payload into one buy price per simulated hour."""

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
        value = fallback_by_type.get(
            tariff_type, fallback_by_type["simple"]).get(period, 0.22)
    return float(value or 0)

def should_allow_grid_arbitrage(tariff: Dict[str, Any]) -> bool:
    """Enable arbitrage only when tariff periods have meaningful spread."""

    tariff_type = tariff.get("type", "simple")
    if tariff_type == "simple":
        return False

    prices = tariff.get("prices") or {}
    active_periods = active_tariff_periods(tariff_type)
    used_prices = [float(prices.get(period, 0) or 0)
                   for period in active_periods if float(prices.get(period, 0) or 0) > 0]
    return len(used_prices) >= 2 and max(used_prices) - min(used_prices) >= 0.05

from __future__ import annotations

from typing import Any, Dict


def apply_margin(price: float, margin: float) -> float:
    return price * (1 + margin) if price > 0 else 0.0

def format_component_name(component: Dict[str, Any]) -> str:
    return " ".join(
        str(value).strip()
        for value in [component.get("brand"), component.get("model")]
        if str(value or "").strip()
    )

def clean_text(value: Any) -> str:
    return str(value or "").strip()

def safe_positive_float(value: Any) -> float:
    try:
        return max(0.0, float(value or 0))
    except (TypeError, ValueError):
        return 0.0

def discounted_value(annual_value: float, years: int, discount_rate: float) -> float:
    if discount_rate <= 0:
        return annual_value * years
    return sum(annual_value / ((1 + discount_rate) ** year) for year in range(1, years + 1))

def clamp_float(value: Any, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, float(value)))


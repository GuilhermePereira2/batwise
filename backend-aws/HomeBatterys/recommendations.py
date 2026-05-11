from __future__ import annotations

from math import ceil
from typing import Any, Dict, List, Optional, Tuple

from .constants import (
    BALANCED_SOLAR_TO_INVERTER_RATIO,
    DEFAULT_PANEL_AREA_M2,
    DEFAULT_USABLE_ROOF_RATIO,
    MAX_RECOMMENDATIONS_PER_TIER,
    MAX_RECOMMENDATION_PAYBACK_YEARS,
    MIN_EXISTING_SOLAR_EXPANSION_KWP,
    MIN_RECOMMENDATION_ANNUAL_SAVINGS_EUR,
    MIN_SOLAR_TO_INVERTER_RATIO,
)
from .profile import get_existing_solar_peak_kwp, solar_yield_kwh_per_kwp
from .simulation import simulate_capacity
from .types import SimulationResult
from .utils import apply_margin, clean_text, format_component_name, safe_positive_float


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
    project_years: int = 12,
) -> List[Dict[str, Any]]:
    """Build catalogue recommendations from the simulated target capacity.

    The economic optimiser only knows battery size. This ranking step combines
    real batteries, inverters and panels, then rejects combinations that fail
    practical sizing or return-on-investment checks.
    """
    if not catalog:
        return []

    inverters = catalog.get("inverters", [])
    panels = catalog.get("solar_panels", [])
    recommendations = []
    target = max(0.5, float(selected["capacity_kwh"]))
    has_existing_solar = bool((solar or {}).get("has_solar"))
    existing_inverter_supports_battery = bool(
        (solar or {}).get("battery_ready_inverter"))
    existing_battery_capacity = get_existing_battery_capacity_kwh(solar)
    existing_solar_peak_kwp = get_existing_solar_peak_kwp(solar)
    total_solar_peak_kwp = max(solar_peak_kwp, existing_solar_peak_kwp)
    expand_existing_solar = False
    auto_expansion_target_kwp = estimate_auto_solar_expansion_target_kwp(
        profile, solar)

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
        if not is_solar_array_sized_for_inverter(inverter, panel_set):
            return

        # Re-simulate with this exact catalogue combination. Expanded solar
        # arrays change the PV profile and can turn a bad battery-only case into
        # a coherent solar-plus-storage recommendation.
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
        battery_base_price = float(battery.get(
            "pricing", {}).get("unit_price", 0) or 0)
        inverter_base_price = float((inverter or {}).get(
            "pricing", {}).get("unit_price", 0) or 0)
        panels_base_price = float(
            (panel_set or {}).get("total_price_eur", 0) or 0)
        battery_price = apply_margin(battery_base_price, component_margin)
        inverter_price = apply_margin(inverter_base_price, component_margin)
        panels_price = apply_margin(panels_base_price, component_margin)
        hardware_total = battery_price + inverter_price + panels_price
        installation_margin_eur = hardware_total * installation_margin
        capex = hardware_total + installation_margin_eur

        # Compare against the user's current bill: existing PV systems already
        # reduce the baseline, while new PV systems are compared with no system.
        current_bill = base.annual_cost_eur if has_existing_solar else no_system_base.annual_cost_eur
        annual_savings = current_bill - result.annual_cost_eur
        payback = capex / annual_savings if annual_savings > 0 else None
        if not is_recommendation_economically_viable(annual_savings, payback, project_years):
            return
        fit_penalty = abs(simulated_capacity - target) / target
        solar_to_inverter_ratio = calculate_solar_to_inverter_ratio(
            inverter, panel_set)

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
                "technical_checks": {
                    "solar_to_inverter_ratio": round(solar_to_inverter_ratio, 2)
                    if solar_to_inverter_ratio is not None
                    else None,
                    "min_solar_to_inverter_ratio": MIN_SOLAR_TO_INVERTER_RATIO,
                    "max_reasonable_payback_years": round(
                        max_reasonable_payback_years(project_years), 1),
                },
            }
        )

    for base_battery in catalog.get("batteries", []):
        for battery in build_battery_quantity_variants(base_battery, target):
            specs = battery.get("specs", {})
            capacity = float(specs.get("usable_capacity_kwh")
                             or specs.get("capacity_kwh") or 0)
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
                    additional_target_kwp = max(
                        0.0, total_solar_peak_kwp - existing_solar_peak_kwp)
                    existing_panel_area = float(
                        panel_set.get("total_panel_area_m2", 0) or 0)
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
                        panel_set = build_expanded_solar_panel_set(
                            solar, additional_panel_set, roof_area_m2)
            else:
                panel_set = select_solar_panel_set(
                    panels,
                    battery,
                    inverter,
                    solar_peak_kwp,
                    catalog.get("compatibility"),
                    roof_area_m2,
                )
            append_recommendation(
                battery, capacity, simulated_capacity, inverter, panel_set)

            if has_existing_solar and not expand_existing_solar:
                expansion_targets = build_existing_solar_expansion_targets(
                    solar, auto_expansion_target_kwp)
                existing_panel_set = build_existing_solar_panel_set(
                    solar, roof_area_m2)
                existing_panel_area = float(
                    existing_panel_set.get("total_panel_area_m2", 0) or 0)
            else:
                expansion_targets = []

            for expansion_strategy, expansion_target_kwp in expansion_targets:
                expanded_inverter = (
                    build_existing_battery_ready_inverter(solar)
                    if existing_inverter_supports_battery
                    else select_inverter_for_battery(
                        battery,
                        inverters,
                        catalog.get("compatibility"),
                        expansion_target_kwp,
                        requires_pv_input=bool(panels or has_existing_solar),
                    )
                )
                additional_target_kwp = expansion_target_kwp - existing_solar_peak_kwp
                additional_panel_set = select_solar_panel_set(
                    panels,
                    battery,
                    expanded_inverter,
                    additional_target_kwp,
                    catalog.get("compatibility"),
                    roof_area_m2,
                    existing_peak_kwp=existing_solar_peak_kwp,
                    reserved_roof_area_m2=existing_panel_area,
                    allow_dc_oversize=expansion_strategy == "load_matched",
                    target_inverter_ratio=(
                        BALANCED_SOLAR_TO_INVERTER_RATIO
                        if expansion_strategy == "load_matched"
                        else MIN_SOLAR_TO_INVERTER_RATIO
                    ),
                )
                if additional_panel_set:
                    expanded_panel_set = build_expanded_solar_panel_set(
                        solar, additional_panel_set, roof_area_m2)
                    expanded_panel_set["auto_expanded"] = True
                    expanded_panel_set["expansion_strategy"] = expansion_strategy
                    append_recommendation(
                        battery, capacity, simulated_capacity, expanded_inverter, expanded_panel_set)

    return select_budgeted_recommendations(recommendations)

def build_battery_quantity_variants(
    battery: Dict[str, Any],
    target_capacity_kwh: float,
) -> List[Dict[str, Any]]:
    """Expand a catalogue battery into allowed parallel-module variants."""

    specs = battery.get("specs", {})
    unit_capacity = float(specs.get("usable_capacity_kwh")
                          or specs.get("capacity_kwh") or 0)
    if unit_capacity <= 0:
        return [battery]

    max_parallel = int(float(specs.get("max_parallel_connection") or 1))
    max_parallel = max(1, max_parallel)

    # Keep the catalogue search bounded: offer enough parallel modules to reach
    # and exceed the target capacity, but avoid flooding the recommendation list.
    sensible_max = max(1, ceil((target_capacity_kwh * 1.5) / unit_capacity))
    max_quantity = min(max_parallel, max(1, sensible_max), 6)

    return [
        build_battery_quantity_variant(battery, quantity)
        for quantity in range(1, max_quantity + 1)
    ]

def build_battery_quantity_variant(
    battery: Dict[str, Any],
    quantity: int,
) -> Dict[str, Any]:
    """Return one battery item scaled by module quantity.

    Compatibility rules still use the original component id. ``unit_specs`` keeps
    the base module values available for inverter sizing, because a parallel
    stack does not require the inverter to match the sum of all module power.
    """

    if quantity <= 1:
        return {
            **battery,
            "quantity": 1,
            "unit_id": battery.get("id"),
            "unit_specs": dict(battery.get("specs", {})),
        }

    specs = dict(battery.get("specs", {}))
    unit_specs = dict(specs)
    pricing = dict(battery.get("pricing", {}))

    for key in ("capacity_kwh", "usable_capacity_kwh", "power_kw"):
        value = specs.get(key)
        if value is not None:
            specs[key] = float(value) * quantity

    unit_price = float(pricing.get("unit_price", 0) or 0)
    pricing["unit_price_each"] = unit_price
    pricing["unit_price"] = unit_price * quantity

    return {
        **battery,
        "quantity": quantity,
        "unit_id": battery.get("id"),
        "unit_specs": unit_specs,
        "specs": specs,
        "pricing": pricing,
    }

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

    yield_kwh_per_kwp = solar_yield_kwh_per_kwp(
        solar or {"country": "Portugal", "city": "Lisboa"})
    load_matched_peak = annual_load / \
        yield_kwh_per_kwp if yield_kwh_per_kwp > 0 else existing_peak
    target_peak = max(existing_peak + 2.0, load_matched_peak * 1.15)
    return round(min(10.0, target_peak), 2)

def build_existing_solar_expansion_targets(
    solar: Optional[Dict[str, Any]],
    load_matched_target_kwp: float,
) -> List[Tuple[str, float]]:
    """Return PV expansion targets for homes that already have undersized solar."""

    existing_peak = get_existing_solar_peak_kwp(solar)
    if existing_peak <= 0:
        return []

    # The first expansion should be the smallest technically coherent option:
    # keep the replacement inverter near the existing array and add roughly
    # 2 kWp, instead of jumping straight to the annual load-matched system.
    minimum_target = existing_peak + MIN_EXISTING_SOLAR_EXPANSION_KWP
    targets = [("minimum_coherent", round(minimum_target, 2))]

    if load_matched_target_kwp > minimum_target + 0.5:
        targets.append(("load_matched", round(load_matched_target_kwp, 2)))

    return targets

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
    battery_name = format_component_name(battery)
    battery_quantity = int(battery.get("quantity", 1) or 1)
    if battery_quantity > 1 and battery_name:
        battery_name = f"{battery_quantity}x {battery_name}"
    parts = [battery_name]
    if inverter:
        parts.append(format_component_name(inverter))
    if panel_set:
        if panel_set.get("expanded"):
            panel = panel_set.get("panel") or {}
            quantity = int(panel_set.get("quantity", 0) or 0)
            panel_name = format_component_name(panel)
            existing_power = panel_set.get("existing_power_kwp", 0)
            if quantity > 0 and panel_name:
                parts.append(
                    f"painéis existentes {existing_power} kWp + {quantity}x {panel_name}")
            else:
                parts.append(
                    f"painéis existentes {panel_set.get('array_power_kwp', 0)} kWp")
        elif panel_set.get("existing"):
            parts.append(
                f"painéis existentes {panel_set.get('array_power_kwp', 0)} kWp")
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
        notes.append(
            "O inversor atual foi assumido como compatível com bateria e não foi incluído um inversor novo no preço.")
    elif inverter:
        notes.append(
            "O inversor atual não suporta bateria: não será reaproveitado e terá de ser retirado/substituído por este inversor novo.")
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
    max_power_kw = safe_positive_float(
        (solar or {}).get("existing_battery_max_power_kw"))
    return {
        "has_battery": True,
        "capacity_kwh": round(capacity, 2),
        "brand": clean_text((solar or {}).get("existing_battery_brand")),
        "model": clean_text((solar or {}).get("existing_battery_model")),
        "max_power_kw": round(max_power_kw, 2) if max_power_kw > 0 else None,
    }

def calculate_solar_to_inverter_ratio(
    inverter: Optional[Dict[str, Any]],
    panel_set: Optional[Dict[str, Any]],
) -> Optional[float]:
    inverter_power = get_inverter_power_kw(inverter)
    if inverter_power <= 0:
        return None

    solar_peak_kwp = float((panel_set or {}).get("array_power_kwp", 0) or 0)
    if solar_peak_kwp <= 0:
        return 0.0

    return solar_peak_kwp / inverter_power

def is_solar_array_sized_for_inverter(
    inverter: Optional[Dict[str, Any]],
    panel_set: Optional[Dict[str, Any]],
) -> bool:
    """Reject PV/inverter pairings that are technically incoherent.

    A new hybrid inverter installed behind an existing PV system should not be
    recommended if the connected array is tiny compared with the inverter. This
    is what caused 1 kWp of existing panels to be paired with a 3 kW inverter.
    """
    ratio = calculate_solar_to_inverter_ratio(inverter, panel_set)
    if ratio is None:
        return True
    return ratio >= MIN_SOLAR_TO_INVERTER_RATIO

def max_reasonable_payback_years(project_years: int) -> float:
    project_limit = max(1, project_years) * 1.5
    return min(MAX_RECOMMENDATION_PAYBACK_YEARS, max(10.0, project_limit))

def is_recommendation_economically_viable(
    annual_savings: float,
    payback_years: Optional[float],
    project_years: int,
) -> bool:
    if annual_savings < MIN_RECOMMENDATION_ANNUAL_SAVINGS_EUR:
        return False
    if payback_years is None:
        return False
    return payback_years <= max_reasonable_payback_years(project_years)

def build_existing_battery_ready_inverter(solar: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    peak_kw = max(0.0, float((solar or {}).get("peak_kw", 0) or 0))
    max_power_kw = safe_positive_float((solar or {}).get(
        "existing_inverter_max_power_kw")) or peak_kw
    brand = clean_text((solar or {}).get(
        "existing_inverter_brand")) or "Inversor atual"
    model = clean_text((solar or {}).get(
        "existing_inverter_model")) or "compatível com bateria"
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

def build_existing_solar_panel_set(solar: Optional[Dict[str, Any]], roof_area_m2: Optional[float] = None) -> Dict[str, Any]:
    peak_kw = max(0.0, float((solar or {}).get("peak_kw", 0) or 0))
    estimated_panel_count = ceil((peak_kw * 1000) / 440) if peak_kw > 0 else 0
    total_panel_area = estimated_panel_count * DEFAULT_PANEL_AREA_M2
    roof_coverage_pct = (total_panel_area / roof_area_m2 *
                         100) if roof_area_m2 and roof_area_m2 > 0 else None
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
    roof_coverage_pct = (total_area / roof_area_m2 *
                         100) if roof_area_m2 and roof_area_m2 > 0 else None

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
    """Split recommendations into Budget, Balanced and Premium cards."""

    if not recommendations:
        return []

    tier_labels = {
        "budget": "Budget",
        "balanced": "Balanced",
        "premium": "Premium",
    }
    sorted_by_price = sorted(
        recommendations, key=lambda item: item["capex_total_eur"])
    total = len(sorted_by_price)

    for index, item in enumerate(sorted_by_price):
        if index < total / 3:
            tier = "budget"
        elif index < (total * 2) / 3:
            tier = "balanced"
        else:
            tier = "premium"
        if get_expansion_strategy(item) == "load_matched" and tier == "budget":
            tier = "balanced"
        if int(item.get("battery", {}).get("quantity", 1) or 1) > 1 and tier == "budget":
            tier = "balanced"
        item["budget_tier"] = tier
        item["budget_label"] = tier_labels[tier]

    budget_count = sum(
        1 for item in sorted_by_price if item["budget_tier"] == "budget")
    for item in sorted_by_price:
        if budget_count >= MAX_RECOMMENDATIONS_PER_TIER:
            break
        if item["budget_tier"] == "budget":
            continue
        if get_expansion_strategy(item) == "load_matched":
            continue
        if int(item.get("battery", {}).get("quantity", 1) or 1) > 1:
            continue
        item["budget_tier"] = "budget"
        item["budget_label"] = tier_labels["budget"]
        budget_count += 1

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

    def budget_score(item: Dict[str, Any]) -> tuple:
        return (
            item["capex_total_eur"],
            item["payback_years"] if item["payback_years"] is not None else 999,
            -item["fit_to_ideal"],
        )

    def tier_score(item: Dict[str, Any]) -> tuple:
        if item.get("budget_tier") == "budget":
            return budget_score(item)
        if item.get("budget_tier") == "balanced":
            return budget_score(item)
        return budget_score(item)

    selected_by_tier: Dict[str, List[Dict[str, Any]]] = {
        "budget": [],
        "balanced": [],
        "premium": [],
    }
    selected_keys: set[str] = set()
    for tier in ("budget", "balanced", "premium"):
        tier_items = [
            item for item in sorted_by_price if item["budget_tier"] == tier]
        if tier == "budget":
            non_auto_items = [
                item for item in tier_items
                if not (item.get("solar_panels") or {}).get("auto_expanded")
            ]
            if non_auto_items:
                tier_items = non_auto_items
        elif tier == "balanced":
            budget_ceiling = max(
                (item["capex_total_eur"]
                 for item in selected_by_tier["budget"]),
                default=0,
            )
            tier_items = [
                item for item in tier_items
                if item["capex_total_eur"] >= budget_ceiling
            ]
        elif tier == "premium":
            balanced_ceiling = max(
                (item["capex_total_eur"]
                 for item in selected_by_tier["balanced"]),
                default=0,
            )
            tier_items = [
                item for item in tier_items
                if item["capex_total_eur"] >= balanced_ceiling
            ]
        candidates = sorted(tier_items, key=tier_score)
        for item in candidates:
            key = recommendation_identity(item)
            if key in selected_keys:
                continue
            selected_by_tier[tier].append(item)
            selected_keys.add(key)
            if len(selected_by_tier[tier]) == MAX_RECOMMENDATIONS_PER_TIER:
                break

        if tier == "balanced":
            ensure_preferred_stacked_battery_option(
                selected_by_tier[tier],
                tier_items,
                selected_keys,
            )

        if tier == "premium" and tier_items:
            largest = sorted(tier_items, key=capacity_score)[0]
            largest_key = recommendation_identity(largest)
            already_selected = any(
                recommendation_identity(item) == largest_key
                for item in selected_by_tier[tier]
            )
            if not already_selected and largest_key not in selected_keys:
                if len(selected_by_tier[tier]) >= MAX_RECOMMENDATIONS_PER_TIER:
                    removed = selected_by_tier[tier].pop()
                    selected_keys.discard(recommendation_identity(removed))
                selected_by_tier[tier].append(largest)
                selected_keys.add(largest_key)

    tier_order = {"budget": 0, "balanced": 1, "premium": 2}
    selected = [
        item
        for tier in ("budget", "balanced", "premium")
        for item in selected_by_tier[tier]
    ]
    return sorted(
        selected,
        key=lambda item: (
            tier_order.get(item.get("budget_tier", ""), 99),
            tier_score(item),
        ),
    )

def get_expansion_strategy(item: Dict[str, Any]) -> str:
    return str((item.get("solar_panels") or {}).get("expansion_strategy") or "")

def ensure_preferred_stacked_battery_option(
    selected_items: List[Dict[str, Any]],
    tier_items: List[Dict[str, Any]],
    selected_keys: set[str],
) -> None:
    if any(is_preferred_stacked_battery(item) for item in selected_items):
        return

    candidates = [
        item for item in tier_items
        if is_preferred_stacked_battery(item)
    ]
    if not candidates:
        return

    candidate = min(candidates, key=lambda item: item["capex_total_eur"])
    candidate_key = recommendation_identity(candidate)
    if candidate_key in selected_keys:
        return

    if len(selected_items) >= MAX_RECOMMENDATIONS_PER_TIER:
        removed = selected_items.pop()
        selected_keys.discard(recommendation_identity(removed))

    selected_items.append(candidate)
    selected_keys.add(candidate_key)
    selected_items.sort(key=lambda item: item["capex_total_eur"])

def is_preferred_stacked_battery(item: Dict[str, Any]) -> bool:
    battery = item.get("battery", {})
    quantity = int(battery.get("quantity", 1) or 1)
    brand = str(battery.get("brand", "")).lower()
    return quantity > 1 and "pylontech" in brand

def recommendation_identity(item: Dict[str, Any]) -> str:
    panel_set = item.get("solar_panels") or {}
    return "|".join(
        [
            str(item.get("battery", {}).get("id", "")),
            str(item.get("battery", {}).get("quantity", 1)),
            str(item.get("inverter", {}).get("id", "")),
            str(panel_set.get("array_power_kwp", "")),
        ]
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
    target_inverter_ratio: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """Select a compatible panel model and quantity for a target PV size."""

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
        if target_inverter_ratio is None:
            target_inverter_ratio = 1.35 if allow_dc_oversize else MIN_SOLAR_TO_INVERTER_RATIO
        inverter_target = inverter_power * target_inverter_ratio
        target_kwp = max(target_kwp, inverter_target - existing_peak_kwp)
    if max_pv_input_kwp > 0:
        remaining_pv_input = max(0.0, max_pv_input_kwp - existing_peak_kwp)
        target_kwp = min(target_kwp, remaining_pv_input)
    elif inverter_power > 0:
        inverter_limit = inverter_power * (1.35 if allow_dc_oversize else 1.0)
        target_kwp = min(target_kwp, max(
            0.0, inverter_limit - existing_peak_kwp))
    if inverter_power > 0 and not allow_dc_oversize:
        target_kwp = min(target_kwp, max(
            0.0, inverter_power - existing_peak_kwp))

    if target_kwp <= 0:
        return None

    def score(panel: Dict[str, Any]) -> tuple:
        power_w = float(panel.get("specs", {}).get("power_w", 0) or 0)
        price = float(panel.get("pricing", {}).get("unit_price", 0) or 0)
        efficiency = float(panel.get("specs", {}).get(
            "efficiency_pct", 0) or 0)
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
        max_quantities.append(
            max(1, int((max_pv_input_kwp * 1000) // power_w)))
    rule_max = get_inverter_panel_max_count(inverter, panel, compatibility)
    if rule_max:
        max_quantities.append(rule_max)
    if roof_area_m2 and roof_area_m2 > 0:
        usable_roof_area = max(
            0.0, roof_area_m2 * DEFAULT_USABLE_ROOF_RATIO - reserved_roof_area_m2)
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
    roof_coverage_pct = (total_panel_area_m2 / roof_area_m2 *
                         100) if roof_area_m2 and roof_area_m2 > 0 else None

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
    """Pick the smallest compatible inverter that satisfies battery and PV needs."""

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
        power_gap = abs(inverter_power -
                        battery_power) if battery_power > 0 else 0
        undersized_penalty = 10 if battery_power > 0 and inverter_power < battery_power * 0.75 else 0
        pv_oversized_penalty = 0
        if pv_peak_kwp > 0 and inverter_power > pv_peak_kwp * 1.5:
            pv_oversized_penalty = inverter_power - pv_peak_kwp * 1.5
        hybrid_bonus = -1 if specs.get("is_hybrid") else 0

        compatible_brands = [str(brand).lower() for brand in specs.get(
            "compatible_battery_brands", [])]
        brand_penalty = 0
        if compatible_brands and battery_brand not in compatible_brands:
            brand_penalty = 20

        price = float(inverter.get("pricing", {}).get("unit_price", 0) or 0)
        return (
            brand_penalty,
            undersized_penalty,
            pv_oversized_penalty,
            inverter_power,
            price,
            power_gap,
            hybrid_bonus,
        )

    return min(compatible_inverters, key=score)

def is_inverter_sized_for_battery(battery: Dict[str, Any], inverter: Dict[str, Any]) -> bool:
    specs = battery.get("specs", {})
    unit_specs = battery.get("unit_specs") or specs
    battery_capacity = float(
        specs.get("usable_capacity_kwh") or specs.get("capacity_kwh") or 0)
    battery_power = float(specs.get("power_kw", 0) or 0)
    sizing_capacity = float(
        unit_specs.get("usable_capacity_kwh")
        or unit_specs.get("capacity_kwh")
        or battery_capacity
        or 0
    )
    sizing_power = float(unit_specs.get("power_kw") or battery_power or 0)
    inverter_power = get_inverter_power_kw(inverter)
    if inverter_power <= 0:
        return True
    minimum_by_power = sizing_power * 0.75 if sizing_power > 0 else 0.0
    minimum_by_capacity = sizing_capacity * 0.35 if sizing_capacity > 0 else 0.0
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
    exact_rules = [rule for rule in rules if rule.get(
        "solar_panel_id") == panel_id]
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
    """Evaluate catalogue compatibility rules for battery/inverter/panel sets."""

    if not compatibility:
        return True

    if "group_members" in compatibility or "inverter_solar_panel_rules" in compatibility:
        battery_inverter_ok = is_battery_inverter_compatible_from_sqlite(
            battery, inverter, compatibility)
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

    exact_panel_rules = [rule for rule in matching_rules if rule.get(
        "solar_panel_id") == panel_id]
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
            expected_battery_type = normalize_voltage_class(
                value.get("battery_type"))
            expected_inverter_type = normalize_voltage_class(
                value.get("inverter_battery_technology"))
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

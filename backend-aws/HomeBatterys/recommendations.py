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
    max_investment: Optional[float] = None,
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
    existing_battery_capacity = get_existing_battery_capacity_kwh(solar)
    existing_solar_peak_kwp = get_existing_solar_peak_kwp(solar)
    expand_existing_solar = bool((solar or {}).get("expand_solar", True))

    if has_existing_solar and not expand_existing_solar:
        total_solar_peak_kwp = existing_solar_peak_kwp
        inverter_sizing_pv_peak = 0.0  # Dimensionar apenas pela bateria
    else:
        total_solar_peak_kwp = max(solar_peak_kwp, existing_solar_peak_kwp)
        inverter_sizing_pv_peak = total_solar_peak_kwp

    auto_expansion_target_kwp = estimate_auto_solar_expansion_target_kwp(
        profile, solar)

    # O inversor só PRECISA obrigatoriamente de entrada PV se:
    # 1. É um sistema novo com painéis
    # 2. É um sistema existente e o utilizador quer expandir os painéis
    requires_pv_input = expand_existing_solar or (not has_existing_solar and bool(panels))

    def append_recommendation(
        battery: Optional[Dict[str, Any]],
        capacity: float,
        simulated_capacity: float,
        inverter: Optional[Dict[str, Any]],
        panel_set: Optional[Dict[str, Any]],
    ) -> None:
        if not battery and not panel_set:
            return
        
        # Ensure at least one NEW component is being added
        new_battery_added = (capacity > 0)
        new_panels_added = bool(panel_set) and not panel_set.get("existing")
        # Expanded sets are considered new because they add panels to existing ones
        if panel_set and panel_set.get("expanded"):
            new_panels_added = (int(panel_set.get("quantity", 0) or 0) > 0)

        if not new_battery_added and not new_panels_added:
            return

        if inverters and not inverter:
            return

        # Se não estamos a expandir, ignoramos a validação de rácio painel/inversor
        # (visto que o utilizador quer dimensionar apenas pela bateria)
        if panel_set and (expand_existing_solar or (not has_existing_solar and bool(panels))):
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
        battery_base_price = float((battery or {}).get(
            "pricing", {}).get("unit_price", 0) or 0)
        inverter_base_price = float((inverter or {}).get(
            "pricing", {}).get("unit_price", 0) or 0)
        panels_base_price = float(
            (panel_set or {}).get("total_price_eur", 0) or 0)
        battery_price = apply_margin(battery_base_price, component_margin)
        inverter_price = apply_margin(inverter_base_price, component_margin)
        panels_price = apply_margin(panels_base_price, component_margin)
        hardware_total = battery_price + inverter_price + panels_price

        # Filtro de investimento máximo (Hardware total, já que a instalação está oculta)
        if max_investment is not None and hardware_total > max_investment:
            return

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
                "capex_total_eur": round(hardware_total, 2), # Alterado para hardware_total apenas
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
            inverter = select_inverter_for_battery(
                battery,
                inverters,
                catalog.get("compatibility"),
                inverter_sizing_pv_peak,
                requires_pv_input=requires_pv_input,
            )
            if has_existing_solar:
                existing_only_panel_set = build_existing_solar_panel_set(solar, roof_area_m2)
                panel_set = existing_only_panel_set
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
                existing_only_panel_set = None
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

            # --- STANDALONE OPTIONS ---
            # 1. Battery Only (No new panels)
            if panel_set != existing_only_panel_set:
                inverter_no_new_pv = select_inverter_for_battery(
                    battery,
                    inverters,
                    catalog.get("compatibility"),
                    existing_solar_peak_kwp,
                    requires_pv_input=False,
                )
                append_recommendation(
                    battery, capacity, simulated_capacity, inverter_no_new_pv, existing_only_panel_set)
            
            # 2. Solar Only (No new battery capacity added)
            if panel_set != existing_only_panel_set and capacity > 0:
                inverter_no_new_bat = select_inverter_for_battery(
                    None,
                    inverters,
                    catalog.get("compatibility"),
                    total_solar_peak_kwp,
                    requires_pv_input=True,
                )
                append_recommendation(
                    None, 0, existing_battery_capacity, inverter_no_new_bat, panel_set)

            if has_existing_solar and expand_existing_solar:
                expansion_targets = build_existing_solar_expansion_targets(
                    solar, auto_expansion_target_kwp)
                existing_panel_set = build_existing_solar_panel_set(
                    solar, roof_area_m2)
                existing_panel_area = float(
                    existing_panel_set.get("total_panel_area_m2", 0) or 0)
            else:
                expansion_targets = []

            for expansion_strategy, expansion_target_kwp in expansion_targets:
                expanded_inverter = select_inverter_for_battery(
                    battery,
                    inverters,
                    catalog.get("compatibility"),
                    expansion_target_kwp,
                    requires_pv_input=True,  # Expansão obriga sempre a PV input
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
    return round(min(25.0, target_peak), 2)


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
    battery: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
    panel_set: Optional[Dict[str, Any]],
) -> str:
    battery_name = format_component_name(battery)
    battery_quantity = int((battery or {}).get("quantity", 1) or 1)
    if battery_quantity > 1 and battery_name:
        battery_name = f"{battery_quantity}x {battery_name}"
    parts = [battery_name] if battery_name else []
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

    specs = (inverter or {}).get("specs", {})
    has_pv = bool(specs.get("has_direct_pv_input") or float(
        specs.get("max_pv_input_kwp") or 0) > 0)

    if has_pv:
        return []
    else:
        return ["Será adicionado um inversor dedicado para as baterias (AC-coupled), mantendo o seu inversor solar atual para a produção fotovoltaica."]


def build_existing_inverter_action(
    solar: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not (solar or {}).get("has_solar"):
        return None

    specs = (inverter or {}).get("specs", {})
    has_pv = bool(specs.get("has_direct_pv_input") or float(
        specs.get("max_pv_input_kwp") or 0) > 0)

    if has_pv:
        return "replace"
    else:
        return "keep"


def get_existing_battery_capacity_kwh(solar: Optional[Dict[str, Any]]) -> float:
    if not (solar or {}).get("has_solar"):
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
    if ratio is not None and ratio < MIN_SOLAR_TO_INVERTER_RATIO:
        return False

    # Check if the panel voltage meets the inverter's minimum requirement
    # (Assuming 40V per panel as per requirements)
    inverter_specs = (inverter or {}).get("specs", {})
    min_pv_voltage = float(inverter_specs.get("pv_voltage_range_v", {}).get("min") or 0)
    
    if min_pv_voltage > 0:
        # For new/expanded sets, we have an explicit quantity
        quantity = int((panel_set or {}).get("quantity", 0) or 0)
        
        # If it's an existing system without explicit quantity, we estimate it
        if quantity <= 0 and (panel_set or {}).get("existing"):
            peak_kw = float((panel_set or {}).get("array_power_kwp", 0) or 0)
            # Use the same estimation logic as build_existing_solar_panel_set (440W panels)
            quantity = ceil((peak_kw * 1000) / 440) if peak_kw > 0 else 0
            
        if quantity > 0 and (quantity * 40) < min_pv_voltage:
            return False

    return True


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
    """Split recommendations into Budget, Balanced and Premium cards based on 
    specific financial and technical criteria.
    """

    if not recommendations:
        return []

    # Filtrar recomendações únicas para evitar duplicados exatos em diferentes tiers
    # (Identidade baseada em bateria, quantidade e inversor)
    unique_map = {}
    for rec in recommendations:
        key = recommendation_identity(rec)
        if key not in unique_map:
            unique_map[key] = rec
    
    candidates = list(unique_map.values())
    selected_ids = set()
    result = []

    # 1. Budget: As 3 opções mais baratas de hardware
    budget_candidates = sorted(candidates, key=lambda x: x["capex_total_eur"])
    budget_count = 0
    for rec in budget_candidates:
        if budget_count >= 3:
            break
        rec_copy = dict(rec)
        rec_copy["budget_tier"] = "budget"
        rec_copy["budget_label"] = "Budget"
        result.append(rec_copy)
        selected_ids.add(recommendation_identity(rec))
        budget_count += 1

    # 2. Balanced: As 3 opções com retorno (payback) mais rápido (excluindo as já selecionadas)
    remaining_for_balanced = [r for r in candidates if recommendation_identity(r) not in selected_ids]
    balanced_candidates = sorted(
        remaining_for_balanced, 
        key=lambda x: (x["payback_years"] if x["payback_years"] is not None else 999)
    )
    balanced_count = 0
    for rec in balanced_candidates:
        if balanced_count >= 3:
            break
        rec_copy = dict(rec)
        rec_copy["budget_tier"] = "balanced"
        rec_copy["budget_label"] = "Balanced"
        result.append(rec_copy)
        selected_ids.add(recommendation_identity(rec))
        balanced_count += 1

    # 3. Premium: As 3 opções mais caras de hardware (excluindo as já selecionadas)
    remaining_for_premium = [r for r in candidates if recommendation_identity(r) not in selected_ids]
    premium_candidates = sorted(remaining_for_premium, key=lambda x: x["capex_total_eur"], reverse=True)
    premium_count = 0
    for rec in premium_candidates:
        if premium_count >= 3:
            break
        rec_copy = dict(rec)
        rec_copy["budget_tier"] = "premium"
        rec_copy["budget_label"] = "Premium"
        result.append(rec_copy)
        selected_ids.add(recommendation_identity(rec))
        premium_count += 1

    tier_order = {"budget": 0, "balanced": 1, "premium": 2}
    return sorted(
        result,
        key=lambda item: (
            tier_order.get(item.get("budget_tier", ""), 99),
            item["capex_total_eur"] if item.get("budget_tier") != "balanced" else (item["payback_years"] or 999)
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
    battery = item.get("battery")
    inverter = item.get("inverter")
    
    return "|".join(
        [
            str((battery or {}).get("id", "no-battery")),
            str((battery or {}).get("quantity", 0)),
            str((inverter or {}).get("id", "no-inverter")),
            str(panel_set.get("array_power_kwp", "0")),
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

    # Ensure panels meet the inverter's minimum PV voltage (assuming 40V per panel)
    min_pv_voltage = float(inverter_specs.get("pv_voltage_range_v", {}).get("min") or 0)
    if min_pv_voltage > 0:
        min_panels_by_voltage = ceil(min_pv_voltage / 40)
        quantity = max(quantity, min_panels_by_voltage)

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
    battery: Optional[Dict[str, Any]],
    inverters: List[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]] = None,
    pv_peak_kwp: float = 0.0,
    requires_pv_input: bool = False,
) -> Optional[Dict[str, Any]]:
    """Pick the smallest compatible inverter that satisfies battery and PV needs."""

    if not inverters:
        return None

    battery_specs = (battery or {}).get("specs", {})
    battery_power = float(battery_specs.get("power_kw", 0) or 0)
    battery_brand = str((battery or {}).get("brand", "")).lower()
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


def is_inverter_sized_for_battery(battery: Optional[Dict[str, Any]], inverter: Dict[str, Any]) -> bool:
    if battery is None:
        return True
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
    if not inverter:
        return None

    max_pv_input_kwp = float(
        (inverter.get("specs") or {}).get("max_pv_input_kwp") or 0)
    panel_power_kwp = float(
        (panel.get("specs") or {}).get("rated_power_kw")
        or ((panel.get("specs") or {}).get("power_w") or 0) / 1000
        or 0
    )
    if max_pv_input_kwp <= 0 or panel_power_kwp <= 0:
        return None
    return max(1, int(max_pv_input_kwp // panel_power_kwp))


def is_component_set_compatible(
    battery: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
    solar_panel: Optional[Dict[str, Any]],
    compatibility: Optional[Dict[str, Any]],
) -> bool:
    """Check the direct battery/inverter list and derived PV compatibility."""

    battery_inverter_ok = is_battery_inverter_compatible(battery, inverter)
    if not battery_inverter_ok:
        return False
    if solar_panel is None:
        return True
    return is_inverter_panel_compatible_from_specs(inverter, solar_panel)


def is_battery_inverter_compatible(
    battery: Optional[Dict[str, Any]],
    inverter: Optional[Dict[str, Any]],
) -> bool:
    if not inverter:
        return False
    if inverter.get("existing"):
        return True
    
    # If no battery is being added, we only care about the inverter's standalone properties
    # (which are checked by is_component_set_compatible and others)
    if battery is None:
        return True

    compatible_ids = set(
        battery.get("specs", {}).get("compatible_inverter_ids") or [])
    return inverter.get("id") in compatible_ids


def is_inverter_panel_compatible_from_specs(
    inverter: Optional[Dict[str, Any]],
    solar_panel: Optional[Dict[str, Any]],
) -> bool:
    if not inverter or not solar_panel:
        return False
    if inverter.get("existing") or solar_panel.get("existing"):
        return True

    specs = inverter.get("specs") or {}
    return bool(specs.get("has_direct_pv_input")) and float(
        specs.get("max_pv_input_kwp") or 0) > 0

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .constants import MIN_SOLAR_TO_INVERTER_RATIO
from .profile import (
    build_hourly_profile,
    estimate_recommended_solar_peak_kw,
    estimate_roof_area_m2,
)
from .recommendations import get_existing_battery_capacity_kwh, rank_catalog
from .simulation import (
    build_capacity_candidates,
    choose_technical_capacity,
    estimate_catalog_cost,
    simulate_capacity,
)
from .tariffs import build_hourly_prices, should_allow_grid_arbitrage
from .utils import clamp_float, discounted_value


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

    # Step 1: convert the user's form data into a synthetic hourly year.
    profile, profile_summary = build_hourly_profile(
        mode, input_data, tariff, solar)
    solar_peak_kwp = estimate_recommended_solar_peak_kw(profile_summary, solar)
    if profile_summary["annual_solar_kwh"] <= 0 and solar_peak_kwp > 0:
        recommended_solar = {
            **solar,
            "has_solar": True,
            "peak_kw": solar_peak_kwp,
            "country": solar.get("country", "Portugal"),
            "city": solar.get("city", "Lisboa"),
        }
        profile, profile_summary = build_hourly_profile(
            mode, input_data, tariff, recommended_solar)
    prices = build_hourly_prices(tariff)

    dod = clamp_float(assumptions.get("battery_dod", 0.90), 0.50, 1.0)
    roundtrip_efficiency = clamp_float(
        assumptions.get("roundtrip_efficiency", 1 -
                        float(assumptions.get("system_losses", 0.10))),
        0.70,
        0.98,
    )
    sell_price = max(0.0, float(assumptions.get("sell_price_eur_kwh", 0.05)))
    battery_cost_eur_kwh = max(0.0, float(assumptions.get(
        "battery_cost_eur_kwh", estimate_catalog_cost(catalog))))
    project_years = max(1, int(assumptions.get("project_years", 12)))
    discount_rate = clamp_float(
        assumptions.get("discount_rate", 0.05), 0.0, 0.20)
    component_margin = clamp_float(
        assumptions.get("component_margin", 0.10), 0.0, 1.0)
    installation_margin = clamp_float(
        assumptions.get("installation_margin", 0.10), 0.0, 1.0)

    # Step 2: build two baselines. ``base`` is the current state; ``no_system``
    # is used only when comparing brand-new solar-plus-storage systems.
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

    # Step 3: evaluate generic battery capacities before mapping to products.
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
        npv = discounted_value(
            annual_savings, project_years, discount_rate) - capex
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

    # Step 4: map the selected target to catalogue batteries, inverters and PV.
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
        project_years=project_years,
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
        + [
            "O preço instalado estimado soma bateria, inversor, painéis e uma margem de instalação configurável.",
            f"As recomendações de catálogo filtram sistemas com menos de {int(MIN_SOLAR_TO_INVERTER_RATIO * 100)}% da potência do inversor em painéis e retornos fora de um horizonte razoável.",
        ],
    }

def build_notes(mode: str, profile_summary: Dict[str, float], selected: Dict[str, Any], reason: str) -> List[str]:
    """Build human-readable caveats shown next to the simulator results."""

    notes = [
        "Cálculo baseado num perfil horário sintético anual gerado a partir dos dados introduzidos.",
        "Preços de catálogo não incluem instalação, legalização ou alterações ao quadro elétrico.",

    ]
    if mode == "house":
        notes.append(
            "O consumo foi estimado pelas características da casa; a fatura real melhora a precisão.")
    if profile_summary["annual_solar_kwh"] <= 0:
        notes.append(
            "Sem produção solar, a bateria só cria valor económico relevante quando há diferença forte entre períodos tarifários.")
    if reason == "technical_savings":
        notes.append(
            "A capacidade recomendada maximiza a maior parte da poupança técnica, embora o retorno económico dependa do preço final instalado.")
    if selected["capacity_kwh"] == 0:
        notes.append(
            "Com estes dados, não há caso económico claro para instalar bateria.")

    notes.append("As recomendações fornecidas pela Watt Builder são estimativas baseadas nos dados introduzidos pelo utilizador e em modelos de simulação. Não constituem aconselhamento financeiro, técnico ou contratual. A decisão final de compra é da responsabilidade do utilizador.")
    notes.append("Os valores de poupança apresentados são estimativas e podem variar consoante condições reais de instalação, uso e mercado energético.")
    notes.append(
        "A compatibilidade técnica deve ser sempre validada por um instalador certificado.")

    return notes

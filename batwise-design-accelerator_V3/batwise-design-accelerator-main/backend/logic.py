import math
from functools import lru_cache
from typing import List, Dict, Optional, Tuple, Any
from models import Requirements, CellData, Fuse, Relay, Cable, Bms, Shunt, Configuration, Dimensions, SafetyAssessment

# --- CONSTANTES DE SEGURANÇA E FÍSICA ---
HEIGHT_MARGIN_MM = 30.0
SPACING_THICKNESS_MM = 0.2
SPACING_WIDTH_MM = 0.2
CABLE_TEMP_MAX = 120
RHO_E_COPPER = 1.68e-8
DEFAULT_CABLE_LENGTH_M = 1
THERMAL_RESISTANCE = 0.5
MIN_DELTA_T = 1.0
FUSE_CURRENT_FACTOR = 1.25
RELAY_VOLTAGE_FACTOR = 1.25
RELAY_CURRENT_FACTOR = 1.5

# --- FUNÇÕES AUXILIARES OTIMIZADAS ---


def get_integer_factors(n: int) -> List[Tuple[int, int]]:
    """Retorna pares de fatores (x, y) tal que x * y = n. Otimizado."""
    factors = []
    for i in range(1, int(math.isqrt(n)) + 1):
        if n % i == 0:
            factors.append((i, n // i))
    return factors


@lru_cache(maxsize=2048)
def select_component_fast(components_tuple: Tuple[dict], voltage_req: float, current_req: float) -> Optional[dict]:
    """Seleciona o primeiro componente compatível (assumindo lista ordenada por preço)."""
    for c in components_tuple:
        if c['vdc_max'] >= voltage_req and c['a_max'] >= current_req:
            return c
    return None


def select_bms_fast(bms_tuple: Tuple[dict], series_cells: int, max_current: float) -> Optional[dict]:
    """Lógica específica para BMS."""
    for b in bms_tuple:
        if b['max_cells'] >= series_cells and b['a_max'] >= max_current:
            return b
    return None


@lru_cache(maxsize=1024)
def select_cable_fast(cables_tuple: Tuple[dict], i_peak: float, v_max: float, t_amb: float) -> Optional[dict]:
    """Cálculo térmico de cabos com cache."""
    delta_T = CABLE_TEMP_MAX - t_amb
    if delta_T <= 0:
        delta_T = MIN_DELTA_T

    A_m2 = (pow(i_peak, 2) * RHO_E_COPPER *
            pow(DEFAULT_CABLE_LENGTH_M, 2) * THERMAL_RESISTANCE) / delta_T
    A_mm2_calc = A_m2 * 1e6

    for c in cables_tuple:
        if c['section'] >= A_mm2_calc and c['vdc_max'] >= v_max and c['a_max'] >= i_peak:
            return {
                "brand": c['brand'],
                "model": f"{c['model']} {c.get('model_suffix', '')}".strip(),
                "section": c['section'],
                "vdc_max": c['vdc_max'],
                "a_max": c['a_max'],
                "temp_min": c['temp_min'],
                "temp_max": c['temp_max'],
                "price": c['price'] * DEFAULT_CABLE_LENGTH_M * 2,
                "link": c.get('link', '')
            }
    return None


def config_geometry_validation_fast(cell: CellData, series: int, parallel: int, max_x: float, max_y: float) -> bool:
    """Validação geométrica rápida usando fatorização."""
    total_cells = series * parallel
    e_cell_spacing = cell.Cell_Thickness + SPACING_THICKNESS_MM
    l_cell_spacing = cell.Cell_Width + SPACING_WIDTH_MM

    factors = get_integer_factors(total_cells)
    dim_ops = [(e_cell_spacing, l_cell_spacing),
               (l_cell_spacing, e_cell_spacing)]

    for dim_x, dim_y in dim_ops:
        for nx, ny in factors:
            if (nx * dim_x <= max_x) and (ny * dim_y <= max_y):
                return True
            if (ny * dim_x <= max_x) and (nx * dim_y <= max_y):
                return True
    return False


def assess_safety(req: Requirements, cell: CellData, config_values: dict) -> SafetyAssessment:
    warnings = []
    recs = []
    score = 100
    is_safe = True

    # Calcular C-rate real solicitado
    # I = P / V (Usamos tensão nominal para estimativa geral)
    req_current = config_values['continuous_current']

    # Capacidade total do pack em Ah
    pack_capacity_ah = (cell.Capacity / 1000) * config_values['parallel_cells']

    # C-rate efetivo = Corrente Total / Capacidade Total
    actual_c_rate = req_current / pack_capacity_ah if pack_capacity_ah > 0 else 999

    limit_continuous = cell.MaxContinuousDischargeRate

    # 1. Verificação de Corrente (Thermal & Safety)
    if actual_c_rate > limit_continuous:
        warnings.append(
            "DANGER: Discharge current exceeds cell physical limits. High fire risk.")
        score = 0
        is_safe = False

    elif actual_c_rate > (limit_continuous * 0.8):
        warnings.append(
            f"Warning: High Load ({actual_c_rate:.2f}C). Cells will overheat without active cooling.")
        score -= 20
        recs.append("Add spacing (min 2mm) between cells for airflow.")
        recs.append("Consider using a higher capacity cell to reduce stress.")

    # 2. Verificação de Tensão (Voltage Safety)
    if config_values['voltage'] > 60:
        warnings.append(
            "High Voltage (>60V): Lethal shock risk. Requires specialized handling and insulation.")
        recs.append("Ensure all connections are insulated (IP54 or higher).")

    return SafetyAssessment(
        is_safe=is_safe,
        safety_score=score,
        warnings=warnings,
        recommendations=recs
    )
# --- MOTOR DE CÁLCULO PRINCIPAL ---


def compute_cell_configurations(req: Any, cell_catalogue: List[CellData], component_db: Dict[str, List[Dict]]) -> Tuple[List[Configuration], Dict]:
    configs: List[Configuration] = []

    # 1. PRÉ-PROCESSAMENTO: Ordenar listas para algoritmo "Greedy" (apanhar o primeiro que serve)
    sorted_fuses = sorted(component_db.get('fuses', []),
                          key=lambda x: x.get('price', float('inf')))
    sorted_relays = sorted(component_db.get('relays', []),
                           key=lambda x: x.get('price', float('inf')))
    sorted_shunts = sorted(component_db.get('shunts', []),
                           key=lambda x: x.get('price', float('inf')))
    sorted_bms = sorted(component_db.get('bms', []),
                        key=lambda x: x.get('master_price', float('inf')))
    sorted_cables = sorted(component_db.get('cables', []),
                           key=lambda x: x.get('section', float('inf')))

    # Converter para Tuplas (Cacheável)
    fuses_tuple = tuple(sorted_fuses)
    relays_tuple = tuple(sorted_relays)
    cables_tuple = tuple(sorted_cables)
    shunts_tuple = tuple(sorted_shunts)
    bms_tuple = tuple(sorted_bms)

    stats = {
        "totalAttempts": 0, "failedHeight": 0, "failedGeometry": 0, "failedWeight": 0,
        "failedPower": 0, "failedEnergy": 0, "failedFuse": 0, "failedRelay": 0,
        "failedCable": 0, "failedBMS": 0, "failedShunt": 0, "failedPrice": 0,
        "validConfigurations": 0
    }

    print(f"Starting calculation with {len(cell_catalogue)} cells from DB...")

    for cell in cell_catalogue:
        # Check Altura
        if (cell.Cell_Height + HEIGHT_MARGIN_MM) > req.max_height:
            stats["failedHeight"] += 1
            continue

        min_series = math.ceil(req.min_voltage / cell.NominalVoltage)
        max_series = math.floor(req.max_voltage / cell.NominalVoltage)

        if min_series > max_series:
            continue

        # Pré-cálculos da célula
        cell_energy = (cell.Capacity * 1e-3) * cell.NominalVoltage
        cell_power = (cell.Capacity * 1e-3 *
                      cell.MaxContinuousDischargeRate) * cell.NominalVoltage

        for series in range(min_series, max_series + 1):
            bat_voltage = series * cell.NominalVoltage
            max_voltage = series * cell.ChargeVoltage

            # Smart Start Loop
            min_p_energy = math.ceil(
                req.min_energy / (series * cell_energy)) if cell_energy > 0 else 1
            min_p_power = math.ceil(
                req.min_continuous_power / (series * cell_power)) if cell_power > 0 else 1
            start_p = max(min_p_energy, min_p_power, 1)

            for parallel in range(start_p, 6):  # Limite 5P
                stats["totalAttempts"] += 1

                total_cells = series * parallel
                bat_weight = (cell.Weight * 1e-3) * total_cells

                if bat_weight > req.max_weight:
                    stats["failedWeight"] += 1
                    continue

                if not config_geometry_validation_fast(cell, series, parallel, req.max_width, req.max_length):
                    stats["failedGeometry"] += 1
                    continue

                cont_current = req.min_continuous_power / bat_voltage

                safety = assess_safety(req, cell, {
                    'continuous_current': cont_current,
                    'parallel_cells': parallel,
                    'voltage': bat_voltage
                })

                # Se for perigoso, ignorar imediatamente esta configuração
                if not safety.is_safe:
                    continue

                # Seleção Componentes
                peak_current = (cell.Capacity * 1e-3 *
                                cell.MaxContinuousDischargeRate) * parallel * 5

                fuse = select_component_fast(
                    fuses_tuple, max_voltage, peak_current * FUSE_CURRENT_FACTOR)
                if not fuse:
                    stats["failedFuse"] += 1
                    continue

                relay = select_component_fast(
                    relays_tuple, max_voltage * RELAY_VOLTAGE_FACTOR, peak_current * RELAY_CURRENT_FACTOR)
                if not relay:
                    stats["failedRelay"] += 1
                    continue

                cable = select_cable_fast(
                    cables_tuple, peak_current, max_voltage, req.ambient_temp)
                if not cable:
                    stats["failedCable"] += 1
                    continue

                bms = select_bms_fast(bms_tuple, series, peak_current)
                if not bms:
                    stats["failedBMS"] += 1
                    continue

                shunt = select_component_fast(
                    shunts_tuple, max_voltage, peak_current)
                if not shunt:
                    stats["failedShunt"] += 1
                    continue

                # Preço e Configuração Final
                cells_cost = cell.Price * total_cells
                total_price = cells_cost + \
                    fuse['price'] + relay['price'] + cable['price'] + \
                    bms['master_price'] + shunt['price']

                if total_price > req.max_price:
                    stats["failedPrice"] += 1
                    continue

                # Criar Objeto
                bat_capacity = (cell.Capacity * 1e-3) * parallel
                config = Configuration(
                    cell=cell, series_cells=series, parallel_cells=parallel,
                    battery_voltage=round(bat_voltage, 1), battery_capacity=round(bat_capacity, 1),
                    battery_energy=round(bat_voltage * bat_capacity), battery_weight=round(bat_weight, 1),
                    battery_impedance=round(
                        ((cell.Impedance * 1e-3) * series) / parallel, 3),
                    continuous_power=round(
                        bat_voltage * (cell.Capacity * 1e-3 * cell.MaxContinuousDischargeRate) * parallel),
                    peak_power=round(bat_voltage * peak_current), cell_price=round(cells_cost, 2),
                    fuse=Fuse(**fuse), relay=Relay(**relay), cable=Cable(**cable),
                    bms=Bms(
                        brand=bms['brand'], model=bms['model'], max_cells=bms['max_cells'],
                        vdc_min=bms['vdc_min'], vdc_max=bms['vdc_max'], a_max=bms['a_max'],
                        temp_min=bms['temp_min'], temp_max=bms['temp_max'],
                        master_price=bms['master_price'], slave_price=bms['slave_price'], link=bms.get(
                            'link', '')
                    ),
                    shunt=Shunt(**shunt), total_price=round(total_price, 2),
                    dimensions=Dimensions(
                        length=round((cell.Cell_Width + SPACING_WIDTH_MM)
                                     * math.ceil(math.sqrt(total_cells)), 1),
                        width=round((cell.Cell_Thickness + SPACING_THICKNESS_MM)
                                    * math.ceil(math.sqrt(total_cells)), 1),
                        height=round(cell.Cell_Height, 1)
                    ),
                    safety=safety,
                    affiliate_link=""
                )
                configs.append(config)

    configs.sort(key=lambda x: x.battery_energy /
                 x.total_price if x.total_price > 0 else 0, reverse=True)
    stats["validConfigurations"] = len(configs)
    return configs, stats

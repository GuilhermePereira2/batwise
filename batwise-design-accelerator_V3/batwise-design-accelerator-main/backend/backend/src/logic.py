import math
from models import Requirements, Configuration, Dimensions, Component

# --- DADOS (Hardcoded por enquanto, tal como no TS) ---

CELL_CATALOGUE = [
    {"Brand": "Gotion", "CellModelNo": "IFP20100140A-30Ah", "Composition": "LFP", "Cell_Stack": "C", "MaxContinuousDischargeRate": 2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.2, "ChargeVoltage": 3.65, "Capacity": 30000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 1.5, "Weight": 615,
        "Cell_Thickness": 20, "Cell_Width": 100, "Cell_Height": 140, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.342857143, "PowerEnergyDensity": 156.097561, "Cycles": 3000, "Price": 12, "OriginCountry": "China", "Connection": "Solder"},
    {"Brand": "Poweroad", "CellModelNo": "L148N50B", "Composition": "NMC", "Cell_Stack": "C", "MaxContinuousDischargeRate": 1.2, "MaxContinuousChargeRate": 1, "NominalVoltage": 3.7, "ChargeVoltage": 4.3, "Capacity": 50000, "TheMaxDischargeCurrentOfTheTabs": 60, "Impedance": 1.11, "Weight": 860,
     "Cell_Thickness": 26.66, "Cell_Width": 148.2, "Cell_Height": 101.9, "TabsThickness": 0.15, "TabsWidth": 6, "TabsLength": 2, "DistanceBetweenTwoTabs": 0, "VolumeEnergyDensity": 0.459503894, "PowerEnergyDensity": 215.1162791, "Cycles": 2000, "Price": 38.38, "OriginCountry": "China", "Connection": "L"},
    # ... (Podes adicionar o resto das células aqui. Para brevidade, incluí as duas primeiras. Copia o resto do teu ficheiro TS)
    # Se quiseres a lista completa que me deste antes, diz-me e eu gero o ficheiro completo.
]
# NOTA: Para este exemplo funcionar, assume que o CELL_CATALOGUE tem pelo menos alguns dados.
# No mundo real, isto viria de uma base de dados SQLite ou PostgreSQL.

COMPONENT_DB = {
    "fuses": [
        {"brand": "Littelfuse Inc", "model": "0999030.ZXN",
            "vdc_max": 58, "a_max": 30, "price": 3.32, "link": ""},
        {"brand": "Cfriend", "model": "EVAE-400A", "vdc_max": 125,
            "a_max": 400, "price": 40, "link": ""},
    ],
    "relays": [
        {"brand": "OZSSLJJ", "model": "RL/180", "vdc_max": 72,
            "a_max": 100, "price": 47, "link": ""},
    ],
    "cables": [
        {"brand": "TLC", "model": "6491X 4mm²", "section": 4,
            "vdc_max": 32, "a_max": 32, "price": 0.44, "link": ""},
        {"brand": "Split Charge", "model": "Hi-Flex Battery Cable 16mm²",
            "section": 16, "vdc_max": 1000, "a_max": 110, "price": 3.3, "link": ""},
    ],
    "bms": [
        {"brand": "Sensata", "model": "c-BMS", "max_cells": 24, "vdc_min": 11,
            "vdc_max": 120, "a_max": 2000, "master_price": 800, "slave_price": 0, "link": ""},
    ],
    "shunts": [
        {"brand": "Isabellenhuette", "model": "IVT-S-100",
            "vdc_max": 1000, "a_max": 120, "price": 380.7, "link": ""},
    ]
}

# --- FUNÇÕES AUXILIARES ---


def select_component(components, voltage_req, current_req):
    suitable = [c for c in components if c['vdc_max']
                >= voltage_req and c['a_max'] >= current_req]
    if not suitable:
        return None
    # Retorna o mais barato
    best = min(suitable, key=lambda x: x.get('price', 0))
    # Adapta para o modelo Pydantic
    return Component(**best)


def select_bms(bms_list, series_cells, max_current):
    suitable = [b for b in bms_list if b['max_cells']
                >= series_cells and b['a_max'] >= max_current]
    if not suitable:
        return None
    best = min(suitable, key=lambda x: x.get('master_price', 0))
    # BMS tem estrutura de preço diferente, adaptamos aqui
    return Component(
        brand=best['brand'],
        model=best['model'],
        price=best['master_price'],
        link=best['link'],
        a_max=best['a_max']
    )


def select_cable(cables, i_peak, v_max, t_amb):
    T_max_cable = 120
    rho_e = 1.68e-8
    cable_length = 1
    R_th = 0.5

    delta_T = T_max_cable - t_amb
    if delta_T <= 0:
        delta_T = 1  # Evitar divisão por zero

    A_m2 = (pow(i_peak, 2) * rho_e * pow(cable_length, 2) * R_th) / delta_T
    A_mm2_calc = A_m2 * 1e6

    suitable = [c for c in cables if c['section'] >=
                A_mm2_calc and c['vdc_max'] >= v_max and c['a_max'] >= i_peak]
    if not suitable:
        return None

    best = min(suitable, key=lambda x: x['section'])  # Menor secção válida

    return Component(
        brand=best['brand'],
        model=best['model'],
        section=best['section'],
        price=best['price'] * cable_length * 2,
        link=best['link']
    )


def config_geometry_validation(cell, series, parallel, max_x, max_y):
    e_cell_spacing = cell['Cell_Thickness'] + 0.2
    l_cell_spacing = cell['Cell_Width'] + 0.2
    n_cells = parallel * series

    orientations = [
        (e_cell_spacing, l_cell_spacing),
        (l_cell_spacing, e_cell_spacing)
    ]

    for e, l in orientations:
        max_config_x = math.floor(max_x / e)
        max_config_y = math.floor(max_y / l)

        for nx in range(1, max_config_x + 1):
            # Otimização: calcular ny diretamente em vez de loop
            if n_cells % nx == 0:
                ny = n_cells // nx
                if ny <= max_config_y:
                    total_width = nx * e
                    total_length = ny * l
                    if total_width <= max_x and total_length <= max_y:
                        return True
    return False

# --- FUNÇÃO PRINCIPAL ---


def calculate_design(req: Requirements):
    configs = []

    # Importante: No futuro, usar Pandas aqui para velocidade extrema
    for cell in CELL_CATALOGUE:
        # Conversão de unidades
        weight_kg = cell['Weight'] * 1e-3
        impedance_ohm = cell['Impedance'] * 1e-3
        capacity_ah = cell['Capacity'] * 1e-3

        required_height = cell['Cell_Height'] + 30
        if required_height > req.max_height:
            continue

        min_series = math.ceil(req.min_voltage / cell['NominalVoltage'])
        max_series = math.floor(req.max_voltage / cell['NominalVoltage'])

        if min_series > max_series:
            continue

        for series in range(min_series, max_series + 1):
            bat_voltage = series * cell['NominalVoltage']
            max_voltage = series * cell['ChargeVoltage']

            cell_energy = capacity_ah * cell['NominalVoltage']
            min_p_energy = math.ceil(req.min_energy / (series * cell_energy))

            cell_cont_current = capacity_ah * \
                cell['MaxContinuousDischargeRate']
            cell_cont_power = cell_cont_current * cell['NominalVoltage']
            min_p_power = math.ceil(
                req.min_continuous_power / (series * cell_cont_power))

            start_p = max(min_p_energy, min_p_power, 1)

            for parallel in range(start_p, 6):  # Limite 5P hardcoded como no TS
                total_cells = series * parallel
                bat_capacity = capacity_ah * parallel
                bat_energy = bat_voltage * bat_capacity
                bat_weight = weight_kg * total_cells

                # Validações Rápidas
                if bat_weight > req.max_weight:
                    continue

                nominal_current = capacity_ah * \
                    cell['MaxContinuousDischargeRate']
                cont_power = bat_voltage * nominal_current * parallel
                if cont_power < req.min_continuous_power:
                    continue

                if bat_energy < req.min_energy:
                    continue

                # Validação Geométrica (mais pesada, fica para o fim)
                if not config_geometry_validation(cell, series, parallel, req.max_width, req.max_length):
                    continue

                # Componentes
                peak_current = cell_cont_current * parallel * 5
                peak_power = bat_voltage * peak_current

                fuse = select_component(
                    COMPONENT_DB['fuses'], max_voltage, peak_current * 1.25)
                relay = select_component(
                    COMPONENT_DB['relays'], max_voltage * 1.25, peak_current * 1.5)
                cable = select_cable(
                    COMPONENT_DB['cables'], peak_current, max_voltage, req.ambient_temp)
                bms = select_bms(COMPONENT_DB['bms'], series, peak_current)
                shunt = select_component(
                    COMPONENT_DB['shunts'], max_voltage, peak_current)

                # Preço
                cells_price = cell['Price'] * total_cells
                total_price = cells_price
                if fuse:
                    total_price += fuse.price
                if relay:
                    total_price += relay.price
                if cable:
                    total_price += cable.price
                if bms:
                    total_price += bms.price
                if shunt:
                    total_price += shunt.price

                if total_price > req.max_price:
                    continue

                # Adicionar Configuração
                bat_impedance = (impedance_ohm * series) / parallel

                config = Configuration(
                    cell=cell,
                    series_cells=series,
                    parallel_cells=parallel,
                    battery_voltage=round(bat_voltage, 1),
                    battery_capacity=round(bat_capacity, 1),
                    battery_energy=round(bat_energy),
                    battery_weight=round(bat_weight, 1),
                    battery_impedance=round(bat_impedance, 3),
                    continuous_power=round(cont_power),
                    peak_power=round(peak_power),
                    cell_price=round(cells_price, 2),
                    fuse=fuse,
                    relay=relay,
                    cable=cable,
                    bms=bms,
                    shunt=shunt,
                    total_price=round(total_price, 2),
                    dimensions=Dimensions(
                        length=round((cell['Cell_Width'] + 0.2)
                                     * math.ceil(math.sqrt(total_cells)), 1),
                        width=round((cell['Cell_Thickness'] + 0.2)
                                    * math.ceil(math.sqrt(total_cells)), 1),
                        height=round(cell['Cell_Height'], 1)
                    ),
                    affiliate_link=""
                )
                configs.append(config)

    # Ordenar por valor (Energia / Preço)
    configs.sort(key=lambda x: x.battery_energy / x.total_price, reverse=True)

    return {
        "results": configs[:30],
        "plotResults": configs[:100],
        "total": len(configs)
    }

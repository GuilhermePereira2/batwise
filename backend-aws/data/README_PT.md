# Dados do Backend

Esta pasta contém os dados de produtos usados pelo backend.

## Ficheiros Principais

- `home_energy_catalog.sqlite`
  Catálogo SQLite usado pelo simulador para baterias domésticas, inversores, painéis solares e compatibilidades.

- `home_database_schema.sql`
  Schema SQL do catálogo de energia doméstica. Usa este ficheiro como referência para nomes de tabelas e relações.

- `check_home_catalog.py`
  Script utilitário para verificar os dados do catálogo doméstico.

- `cells.json`, `cells_basic.json`, `components.json`
  Dados de células/componentes de bateria usados pela lógica antiga de packs de bateria.

- `older_jsons/`
  Exportações antigas do catálogo em JSON, mantidas como referência.

## Modelo de Compatibilidade

O simulador carrega a compatibilidade de produtos a partir de `home_energy_catalog.sqlite`. O schema está documentado em `home_database_schema.sql`.

O catálogo doméstico é intencionalmente pequeno. Deve manter-se com três tabelas:

- `home_batteries`
- `home_inverters`
- `home_solar_panels`

## Regras Bateria para Inversor

A compatibilidade bateria/inversor é guardada directamente em cada linha da bateria:

- `home_batteries.compatible_inverter_ids_json`

Exemplo:

```json
["inv-014", "inv-015", "inv-016"]
```

`backend-aws/main.py` carrega esse JSON para `battery["specs"]["compatible_inverter_ids"]`.

`HomeBatterys/recommendations.py` verifica a lista em `is_battery_inverter_compatible()`.

## Regras Inversor para Painel

Depois de o par bateria/inversor passar, a compatibilidade dos painéis é verificada com `is_inverter_panel_compatible_from_specs()`.

Não há tabela para combinações inversor/painel. O simulador deriva isto a partir das especificações do inversor e do painel:

- o inversor tem de ter `has_direct_pv_input = true`;
- o inversor tem de ter `max_pv_input_kwp > 0`;
- a quantidade de painéis é limitada por `max_pv_input_kwp / rated_power_kw`.

Isto não substitui a validação real de strings por tensão/corrente.

## Baterias em Paralelo

Stacks de baterias em paralelo não vêm de tabelas de compatibilidade. Vêm da própria linha da bateria:

- `home_batteries.max_parallel_connection`
- usado por `HomeBatterys/recommendations.py::build_battery_quantity_variants()`

Por exemplo, se um módulo Pylontech tiver `max_parallel_connection > 1`, o motor de recomendações pode criar variantes `2x`, `3x`, etc., limitadas por regras de dimensão razoável do sistema.


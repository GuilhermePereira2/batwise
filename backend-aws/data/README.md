# Backend Data

This folder contains the product data used by the backend.

## Main Files

- `home_energy_catalog.sqlite`
  SQLite catalogue used by the simulator for home batteries, inverters, solar
  panels and compatibility rules.

- `home_database_schema.sql`
  SQL schema for the home energy catalogue. Use this as the reference for table
  names and relationships.

- `check_home_catalog.py`
  Utility script for checking the home energy catalogue data.

- `cells.json`, `cells_basic.json`, `components.json`
  Battery-cell/component data used by the older battery-pack logic.

- `older_jsons/`
  Previous JSON catalogue exports kept for reference.

## Compatibility Model

The simulator loads compatibility from `home_energy_catalog.sqlite`. The schema
is documented in `home_database_schema.sql`.

The current policy is conservative: `rule-00-default-deny` makes unknown
combinations incompatible. A battery/inverter pair is only accepted when at
least one allow rule matches and no blocking rule matches.

The home catalogue is intentionally small. It should stay at four tables:

- `home_batteries`
- `home_inverters`
- `home_solar_panels`
- `battery_inverter_compatibility_rules`

## Battery to Inverter Rules

Use `battery_inverter_compatibility_rules` for new edits. Each row contains:

- product ids: `battery_ids_json`, `inverter_ids_json`;
- group ids: `battery_group_ids_json`, `inverter_group_ids_json`;
- extra checks: `conditions_json`;
- result: `compatible`, `status`, `evidence_level`, `notes`.

`backend-aws/main.py` reads the SQLite tables in
`load_sqlite_compatibility()` and converts them into the in-memory
`catalog["compatibility"]` object.

`HomeBatterys/recommendations.py` then checks each candidate system with:

1. `is_component_set_compatible()`
2. `is_battery_inverter_compatible_from_sqlite()`
3. `rule_applies_to_components()`
4. `role_constraints_match()`
5. `rule_conditions_match()`

A rule can match by exact component id, by component group, or by a condition.
Product group membership is stored directly on each product row in
`compatibility_group_ids_json`.

Examples:

- `allow-victron-48v-with-pylontech-us`
  Allows Pylontech US batteries with Victron 48 V inverter/chargers.

- `block-low-voltage-battery-on-high-voltage-inverter`
  Blocks a 48 V battery on an HV/400 V inverter.

- `not-verified-same-voltage-without-bms-protocol`
  Blocks combinations where voltage alone looks right but there is no official
  BMS/protocol compatibility rule.

## Inverter to Panel Rules

After the battery/inverter pair passes, panel compatibility is checked with
`is_inverter_panel_compatible_from_specs()`.

There is no table for inverter/panel combinations. The simulator derives this
from the inverter and panel specs:

- inverter must have `has_direct_pv_input = true`;
- inverter must have `max_pv_input_kwp > 0`;
- panel quantity is limited by `max_pv_input_kwp / rated_power_kw`.

This does not replace string voltage/current validation.

## Parallel Batteries

Parallel battery stacks do not come from compatibility tables. They come from
the battery row itself:

- `home_batteries.max_parallel_connection`
- used by `HomeBatterys/recommendations.py::build_battery_quantity_variants()`

For example, if a Pylontech module has `max_parallel_connection > 1`, the
recommendation engine may create `2x`, `3x`, etc. variants, capped by sensible
system size limits.

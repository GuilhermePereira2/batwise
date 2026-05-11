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

The simulator loads product compatibility from `home_energy_catalog.sqlite`.
The schema is documented in `home_database_schema.sql`.

The home catalogue is intentionally small. It should stay at three tables:

- `home_batteries`
- `home_inverters`
- `home_solar_panels`

## Battery to Inverter Rules

Battery/inverter compatibility is stored directly on each battery row:

- `home_batteries.compatible_inverter_ids_json`

Example:

```json
["inv-014", "inv-015", "inv-016"]
```

`backend-aws/main.py` loads that JSON into
`battery["specs"]["compatible_inverter_ids"]`.

`HomeBatterys/recommendations.py` checks it in
`is_battery_inverter_compatible()`.

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

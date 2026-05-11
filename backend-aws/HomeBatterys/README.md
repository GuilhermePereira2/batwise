# HomeBatterys

This folder contains the home battery sizing and recommendation engine used by
the simulator endpoint in `backend-aws/main.py`.

The public entry point is:

```python
from HomeBatterys.optimizer import optimize_home_battery
```

## Flow

1. `optimizer.py` receives the frontend payload.
2. `profile.py` converts house/bill/solar inputs into a synthetic hourly year.
3. `tariffs.py` expands the tariff into hourly prices.
4. `simulation.py` simulates battery dispatch for candidate capacities.
5. `recommendations.py` maps the selected target to real catalogue batteries,
   inverters and solar panels.
6. The response returns summary values, capacity curve and 3 recommendations per
   tier: Budget, Balanced and Premium.

## Files

- `optimizer.py`
  Orchestrates the complete calculation. This is the module imported by the API.
  It builds the profile, runs capacity simulations, chooses the target capacity
  and calls catalogue ranking.

- `profile.py`
  Builds the synthetic hourly consumption and PV profile. It contains the house
  consumption estimator, EV charging assumptions, solar yield estimates and roof
  area estimate.

- `simulation.py`
  Simulates battery charge/discharge over the hourly profile. It also builds the
  candidate capacity curve and chooses the technical battery capacity.

- `recommendations.py`
  Converts the ideal capacity into catalogue recommendations. It handles battery
  parallel variants, inverter selection, panel sizing, compatibility rules,
  economic filters, PV/inverter sizing checks and tier selection.

- `tariffs.py`
  Contains tariff-period logic and hourly price generation. It also decides when
  grid arbitrage is allowed.

- `constants.py`
  Central place for tuning values such as residential load shapes, seasonal
  solar factors, minimum PV/inverter ratio and recommendation limits.

- `types.py`
  Shared dataclasses. Currently contains `SimulationResult`.

- `utils.py`
  Small generic helpers used by multiple modules.

## Important Rules

- Recommendations with a new inverter must have at least 80% of inverter power
  in connected PV capacity.
- Budget options favour minimal coherent systems.
- Balanced options may include a larger PV array and battery stacks.
- Batteries with `max_parallel_connection > 1` can generate multi-module
  variants, such as `2x PYLONTECH US3000C`.
- Recommendations with unrealistic payback are filtered out before tiering.

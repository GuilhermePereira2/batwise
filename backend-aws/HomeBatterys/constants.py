from __future__ import annotations

"""Constants used by the home battery sizing engine.

The values here are deliberately conservative defaults for Portuguese
residential simulations. Keeping them together makes the recommendation rules
visible and easy to tune without searching through dispatch or catalogue code.
"""

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_LOAD_FACTORS = [
    1.12, 1.08, 1.02, 0.96,
    0.92, 0.90, 0.94, 0.94, 0.96, 1.00, 1.06, 1.10,
]
MONTH_SOLAR_FACTORS = [
    0.55, 0.70, 0.95, 1.15,
    1.30, 1.40, 1.45, 1.30, 1.05, 0.80, 0.60, 0.50,
]

DEFAULT_EV_CONSUMPTION_KWH_PER_KM = 0.18
DEFAULT_PANEL_AREA_M2 = 2.0
DEFAULT_USABLE_ROOF_RATIO = 0.75

# Technical catalogue filters. These keep suggestions practical, not just cheap.
MIN_SOLAR_TO_INVERTER_RATIO = 0.0
BALANCED_SOLAR_TO_INVERTER_RATIO = 1.20
MIN_EXISTING_SOLAR_EXPANSION_KWP = 1.0

# Economic filters. Long-payback systems are omitted from the recommendation cards.
MIN_RECOMMENDATION_ANNUAL_SAVINGS_EUR = 1.0
MAX_RECOMMENDATION_PAYBACK_YEARS = 25.0
MAX_RECOMMENDATIONS_PER_TIER = 3

RESIDENTIAL_HOURLY_SHAPE = [
    0.45, 0.38, 0.34, 0.32, 0.34, 0.48,
    0.82, 1.05, 0.92, 0.72, 0.62, 0.58,
    0.64, 0.62, 0.60, 0.66, 0.82, 1.20,
    1.55, 1.62, 1.38, 1.05, 0.78, 0.58,
]

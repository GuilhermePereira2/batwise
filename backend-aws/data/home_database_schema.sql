-- Home energy catalog database schema (generated 2026-05-05T12:42:18Z)
-- Suggested relational structure. Import JSON rows into these tables or adapt to Supabase/PostgreSQL.

CREATE TABLE home_batteries (
  id TEXT PRIMARY KEY,
  component_type TEXT NOT NULL DEFAULT 'battery',
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  battery_family TEXT,
  nominal_voltage_class TEXT,
  battery_type TEXT,
  chemistry TEXT,
  capacity_kwh REAL,
  usable_capacity_kwh REAL,
  continuous_power_kw REAL,
  depth_of_discharge_ratio REAL,
  max_series_connection INTEGER,
  max_parallel_connection INTEGER,
  warranty_years INTEGER,
  environment TEXT,
  operating_temp_min_c REAL,
  operating_temp_max_c REAL,
  width_mm REAL,
  height_mm REAL,
  depth_mm REAL,
  weight_kg REAL,
  unit_price REAL,
  currency TEXT,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  data_completeness_score REAL
);

CREATE TABLE home_inverters (
  id TEXT PRIMARY KEY,
  component_type TEXT NOT NULL DEFAULT 'inverter',
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  inverter_family TEXT,
  is_hybrid BOOLEAN,
  connection_type TEXT,
  grid_type TEXT,
  phases INTEGER,
  rated_output_power_kw REAL,
  power_kw REAL,
  max_pv_input_kwp REAL,
  pv_voltage_min_v REAL,
  pv_voltage_max_v REAL,
  max_battery_charge_discharge_kw REAL,
  battery_technology TEXT,
  nominal_battery_voltage_class TEXT,
  battery_voltage_min_v REAL,
  battery_voltage_max_v REAL,
  max_efficiency_ratio REAL,
  warranty_years INTEGER,
  environment TEXT,
  operating_temp_min_c REAL,
  operating_temp_max_c REAL,
  width_mm REAL,
  height_mm REAL,
  depth_mm REAL,
  weight_kg REAL,
  unit_price REAL,
  currency TEXT,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_direct_pv_input BOOLEAN,
  data_completeness_score REAL
);

CREATE TABLE home_solar_panels (
  id TEXT PRIMARY KEY,
  component_type TEXT NOT NULL DEFAULT 'solar_panel',
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  rated_power_w REAL,
  rated_power_kw REAL,
  efficiency_pct REAL,
  technology TEXT,
  cell_type TEXT,
  length_mm REAL,
  width_mm REAL,
  height_mm REAL,
  weight_kg REAL,
  unit_price REAL,
  currency TEXT,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  data_completeness_score REAL
);

CREATE TABLE component_groups (
  id TEXT PRIMARY KEY,
  component_type TEXT NOT NULL,
  label TEXT,
  voltage_class TEXT,
  has_direct_pv_input BOOLEAN,
  notes TEXT
);

CREATE TABLE component_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES component_groups(id),
  component_type TEXT NOT NULL,
  component_id TEXT NOT NULL,
  sort_order INTEGER
);

CREATE TABLE compatibility_rules (
  id TEXT PRIMARY KEY,
  relation_type TEXT NOT NULL,
  compatible BOOLEAN NOT NULL,
  status TEXT,
  evidence_level TEXT,
  notes TEXT
);

CREATE TABLE compatibility_rule_components (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES compatibility_rules(id),
  role TEXT NOT NULL,
  component_type TEXT NOT NULL,
  component_id TEXT NOT NULL
);

CREATE TABLE compatibility_rule_groups (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES compatibility_rules(id),
  role TEXT NOT NULL,
  component_type TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES component_groups(id)
);

CREATE TABLE compatibility_rule_requirements (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES compatibility_rules(id),
  requirement TEXT NOT NULL,
  sort_order INTEGER
);

CREATE TABLE compatibility_sources (
  id TEXT PRIMARY KEY,
  description TEXT,
  url TEXT,
  source_type TEXT
);

CREATE TABLE compatibility_rule_sources (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES compatibility_rules(id),
  source_id TEXT NOT NULL REFERENCES compatibility_sources(id)
);

CREATE TABLE inverter_solar_panel_rules (
  id TEXT PRIMARY KEY,
  inverter_id TEXT NOT NULL REFERENCES home_inverters(id),
  solar_panel_id TEXT REFERENCES home_solar_panels(id),
  compatible BOOLEAN NOT NULL,
  status TEXT,
  max_pv_input_kwp REAL,
  pv_voltage_min_v REAL,
  pv_voltage_max_v REAL,
  max_panel_count_by_power_only INTEGER,
  requires_string_sizing BOOLEAN,
  notes TEXT
);

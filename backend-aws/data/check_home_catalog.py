#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple


DATA_DIR = Path(__file__).resolve().parent

CATALOGS = {
    "home_batteries.json": {
        "list_key": "batteries",
        "id_prefix": "bat",
        "required_specs": [
            "capacity_kwh",
            "usable_capacity_kwh",
            "power_kw",
            "dod",
            "chemistry",
            "battery_type",
            "size_mm.thickness",
            "size_mm.width",
            "size_mm.height",
            "dimensions_mm.width",
            "dimensions_mm.height",
            "dimensions_mm.depth",
            "weight_kg",
            "operating_temperature_c.min",
            "operating_temperature_c.max",
            "environment",
            "max_series_connection",
            "max_parallel_connection",
            "warranty_years",
        ],
    },
    "home_inverters.json": {
        "list_key": "inverters",
        "id_prefix": "inv",
        "required_specs": [
            "power_kw",
            "rated_output_power_kw",
            "max_pv_input_kwp",
            "pv_voltage_range_v.min",
            "pv_voltage_range_v.max",
            "max_battery_charge_discharge_kw",
            "battery_type",
            "battery_technology",
            "battery_voltage_range_v.min",
            "battery_voltage_range_v.max",
            "grid_type",
            "is_hybrid",
            "connection",
            "max_efficiency",
            "warranty_years",
            "weight_kg",
            "dimensions_mm.width",
            "dimensions_mm.height",
            "dimensions_mm.depth",
            "operating_temperature_c.min",
            "operating_temperature_c.max",
            "environment",
        ],
    },
    "home_solar_panels.json": {
        "list_key": "solar_panels",
        "id_prefix": "pv",
        "required_specs": [
            "power_w",
            "efficiency_pct",
            "technology",
            "type",
            "dimensions_mm.length",
            "dimensions_mm.width",
            "dimensions_mm.height",
            "weight_kg",
        ],
    },
}

REQUIRED_ITEM_FIELDS = ["id", "brand", "model", "specs", "pricing.unit_price", "pricing.currency", "links.url"]


def get_path(data: Dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def has_path(data: Dict[str, Any], path: str) -> bool:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return True


def set_path(data: Dict[str, Any], path: str, value: Any, overwrite: bool = False) -> None:
    current = data
    parts = path.split(".")
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    if overwrite:
        current[parts[-1]] = value
    else:
        current.setdefault(parts[-1], value)


def positive_or_none(value: Any) -> Any:
    if value in ("", None):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return value
    return number if number >= 0 else None


def normalize_battery(item: Dict[str, Any]) -> None:
    specs = item.setdefault("specs", {})
    size = specs.get("size_mm") or {}
    dimensions = specs.setdefault("dimensions_mm", {})
    dimensions.setdefault("width", size.get("width"))
    dimensions.setdefault("height", size.get("height"))
    dimensions.setdefault("depth", size.get("depth", size.get("thickness")))


def normalize_inverter(item: Dict[str, Any]) -> None:
    specs = item.setdefault("specs", {})
    power_kw = (
        specs.get("power_kw")
        or specs.get("rated_output_power_kw")
        or specs.get("max_battery_charge_discharge_kw")
    )
    specs.setdefault("power_kw", positive_or_none(power_kw))
    specs.setdefault("rated_output_power_kw", positive_or_none(power_kw))
    specs.setdefault("max_battery_charge_discharge_kw", positive_or_none(power_kw))

    battery_type = specs.get("battery_type") or specs.get("battery_technology")
    specs.setdefault("battery_type", battery_type)
    specs.setdefault("battery_technology", battery_type)

    if "weight_kg" not in specs and "weight" in specs:
        specs["weight_kg"] = specs.get("weight")

    for path in [
        "max_pv_input_kwp",
        "pv_voltage_range_v.min",
        "pv_voltage_range_v.max",
        "battery_voltage_range_v.min",
        "battery_voltage_range_v.max",
    ]:
        existing = get_path(specs, path)
        set_path(specs, path, positive_or_none(existing), overwrite=True)

    specs.setdefault("grid_type", None)
    specs.setdefault("max_efficiency", None)


def normalize_solar_panel(item: Dict[str, Any]) -> None:
    specs = item.setdefault("specs", {})
    dimensions = specs.setdefault("dimensions_mm", {})
    dimensions.setdefault("length", None)
    dimensions.setdefault("width", None)
    dimensions.setdefault("height", None)
    specs.setdefault("weight_kg", None)


def normalize_item(file_name: str, item: Dict[str, Any], root_currency: str) -> None:
    item.setdefault("specs", {})
    item.setdefault("pricing", {})
    item.setdefault("links", {})
    item["pricing"].setdefault("currency", root_currency)
    item["links"].setdefault("url", "")

    if file_name == "home_batteries.json":
        normalize_battery(item)
    elif file_name == "home_inverters.json":
        normalize_inverter(item)
    elif file_name == "home_solar_panels.json":
        normalize_solar_panel(item)


def normalize_duplicate_ids(items: List[Dict[str, Any]], prefix: str) -> None:
    counts = Counter(str(item.get("id", "")) for item in items)
    used = {str(item.get("id")) for item in items if item.get("id") and counts[str(item.get("id"))] == 1}
    seen: set[str] = set()
    next_index = 1

    for item in items:
        item_id = str(item.get("id", ""))
        if item_id and counts[item_id] == 1 and item_id not in seen:
            seen.add(item_id)
            continue

        if item_id and item_id not in seen:
            seen.add(item_id)
            used.add(item_id)
            continue

        while True:
            candidate = f"{prefix}-{next_index:03d}"
            next_index += 1
            if candidate not in used and candidate not in seen:
                item["id"] = candidate
                used.add(candidate)
                seen.add(candidate)
                break


def validate_catalog(file_name: str, data: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    config = CATALOGS[file_name]
    list_key = config["list_key"]
    errors: List[str] = []
    warnings: List[str] = []

    if list_key not in data or not isinstance(data[list_key], list):
        return [f"{file_name}: missing array '{list_key}'"], warnings

    ids = [item.get("id") for item in data[list_key]]
    for item_id, count in Counter(ids).items():
        if item_id in ("", None):
            errors.append(f"{file_name}: missing id in {count} item(s)")
        elif count > 1:
            errors.append(f"{file_name}: duplicate id '{item_id}' appears {count} times")

    required = REQUIRED_ITEM_FIELDS + [f"specs.{path}" for path in config["required_specs"]]
    for index, item in enumerate(data[list_key], start=1):
        label = item.get("id") or f"#{index}"
        for path in required:
            if not has_path(item, path):
                errors.append(f"{file_name}:{label}: missing {path}")
                continue
            value = get_path(item, path)
            if value is None:
                warnings.append(f"{file_name}:{label}: unknown {path}")
            elif value == "":
                warnings.append(f"{file_name}:{label}: empty {path}")

    return errors, warnings


def validate_compatibility(loaded_catalogs: Dict[str, Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    path = DATA_DIR / "home_component_compatibility.json"
    if not path.exists():
        return ["home_component_compatibility.json: missing file"], []

    data = load_catalog(path)
    errors: List[str] = []
    warnings: List[str] = []
    required_rule_fields = ["battery_id", "inverter_id", "solar_panel_id", "compatible", "status", "notes"]

    battery_ids = {item["id"] for item in loaded_catalogs["home_batteries.json"]["batteries"]}
    inverter_ids = {item["id"] for item in loaded_catalogs["home_inverters.json"]["inverters"]}
    panel_ids = {item["id"] for item in loaded_catalogs["home_solar_panels.json"]["solar_panels"]}

    rules = data.get("rules")
    if not isinstance(rules, list):
        return ["home_component_compatibility.json: missing array 'rules'"], warnings

    for index, rule in enumerate(rules, start=1):
        label = f"rule #{index}"
        for field in required_rule_fields:
            if field not in rule:
                errors.append(f"home_component_compatibility.json:{label}: missing {field}")
            elif rule[field] == "":
                warnings.append(f"home_component_compatibility.json:{label}: empty {field}")

        battery_id = rule.get("battery_id")
        inverter_id = rule.get("inverter_id")
        panel_id = rule.get("solar_panel_id")
        if battery_id not in battery_ids and battery_id != "*":
            errors.append(f"home_component_compatibility.json:{label}: unknown battery_id '{battery_id}'")
        if inverter_id not in inverter_ids and inverter_id != "*":
            errors.append(f"home_component_compatibility.json:{label}: unknown inverter_id '{inverter_id}'")
        if panel_id not in panel_ids and panel_id != "*":
            errors.append(f"home_component_compatibility.json:{label}: unknown solar_panel_id '{panel_id}'")

    return errors, warnings


def load_catalog(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_catalog(path: Path, data: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=4, ensure_ascii=False)
        handle.write("\n")


def run(fix: bool) -> int:
    total_errors: List[str] = []
    total_warnings: List[str] = []
    loaded_catalogs: Dict[str, Dict[str, Any]] = {}

    for file_name, config in CATALOGS.items():
        path = DATA_DIR / file_name
        data = load_catalog(path)
        items = data.get(config["list_key"], [])

        if fix:
            root_currency = data.get("currency", "EUR")
            for item in items:
                normalize_item(file_name, item, root_currency)
            normalize_duplicate_ids(items, config["id_prefix"])
            write_catalog(path, data)

        loaded_catalogs[file_name] = data
        errors, warnings = validate_catalog(file_name, data)
        total_errors.extend(errors)
        total_warnings.extend(warnings)

    errors, warnings = validate_compatibility(loaded_catalogs)
    total_errors.extend(errors)
    total_warnings.extend(warnings)

    if total_errors:
        print("ERRORS")
        for error in total_errors:
            print(f"- {error}")

    if total_warnings:
        print("WARNINGS")
        for warning in total_warnings:
            print(f"- {warning}")

    if not total_errors and not total_warnings:
        print("Home catalog OK")
    elif not total_errors:
        print(f"Home catalog OK with {len(total_warnings)} warning(s)")

    return 1 if total_errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate and normalize the home battery catalog JSON files.")
    parser.add_argument("--fix", action="store_true", help="Normalize aliases and duplicate ids in-place.")
    args = parser.parse_args()
    raise SystemExit(run(args.fix))

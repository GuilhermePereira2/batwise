from __future__ import annotations
import difflib
from typing import Any, Dict, List, Optional, Tuple


def match_existing_inverter(
    brand_input: Optional[str],
    model_input: Optional[str],
    catalog_inverters: List[Dict[str, Any]]
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Matches user input for brand and model against the inverters in the catalog.
    Returns (matched_inverter_dict, confidence_score_0_to_100).
    """
    # Debug input directly to terminal
    print(
        f"DEBUG Retrofit: Brand='{brand_input}', Model='{model_input}'", flush=True)

    if not brand_input or not model_input or not catalog_inverters:
        if not catalog_inverters:
            print("DEBUG Retrofit: Catalog of inverters is empty!", flush=True)
        return None, 0.0

    best_match = None
    max_confidence = 0.0

    # Combine brand and model for a more robust matching string
    input_str = f"{brand_input.strip()} {model_input.strip()}".lower()

    for inverter in catalog_inverters:
        inv_brand = str(inverter.get("brand", "")).strip()
        inv_model = str(inverter.get("model", "")).strip()
        target_str = f"{inv_brand} {inv_model}".lower()

        # We use SequenceMatcher for a robust fuzzy ratio
        ratio = difflib.SequenceMatcher(
            None, input_str, target_str).ratio() * 100

        if ratio > max_confidence:
            max_confidence = ratio
            best_match = inverter

    # Requirement: threshold > 63%
    if max_confidence > 0:
        match_name = f"{best_match.get('brand')} {best_match.get('model')}" if best_match else "None"
        print(
            f"🔍 Retrofit Match: '{input_str}' vs '{match_name}' -> Confidence: {max_confidence:.2f}%", flush=True)

    if max_confidence >= 63.0:
        return best_match, max_confidence

    return None, max_confidence

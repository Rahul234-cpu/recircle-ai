"""
Second-hand price suggestion.

1. Depreciation model: original price × (1 − annual depreciation)^years × condition factor × brand factor.
2. Comparables: median of similar items actually sold on ReCircle (sent by the backend),
   adjusted for condition.
3. Blend: the more comparables we have, the more weight they get (max 70%).
Returns a range, never a single "market value".
"""
from __future__ import annotations

import statistics

ANNUAL_DEPRECIATION = {
    "laptops": 0.25, "mobile-phones": 0.30, "electronics": 0.22, "home-appliances": 0.15, "furniture": 0.12,
    "bicycles": 0.15, "books": 0.30, "clothing": 0.35, "kitchen": 0.20, "other": 0.20,
}
# Typical original prices (₹) used only when the seller gives no original price.
DEFAULT_ORIGINAL = {
    "laptops": 45000, "mobile-phones": 15000, "electronics": 15000, "home-appliances": 20000, "furniture": 12000,
    "bicycles": 8000, "books": 500, "clothing": 1500, "kitchen": 3000, "other": 2000,
}
CONDITION_FACTOR = {"New": 0.95, "Like New": 0.85, "Good": 0.7, "Fair": 0.5, "Needs Repair": 0.25}
PREMIUM_BRANDS = {"apple", "samsung", "sony", "lg", "dell", "lenovo", "hp", "asus", "bosch", "philips", "ikea", "urban ladder", "wakefit", "godrej", "whirlpool", "levi's", "nike", "adidas", "trek", "giant", "firefox"}
FLOOR = 0.08  # never suggest below 8% of original


def _round_price(x: float) -> int:
    if x < 1000:
        return int(round(x / 10) * 10)
    if x < 10000:
        return int(round(x / 50) * 50)
    return int(round(x / 100) * 100)


def estimate(
    category: str,
    condition: str,
    age_months: float | None = None,
    original_price: float | None = None,
    brand: str | None = None,
    comparables: list[dict] | None = None,
    title: str | None = None,
) -> dict:
    factors = []
    cat = category if category in ANNUAL_DEPRECIATION else "other"
    base = original_price if original_price and original_price > 0 else DEFAULT_ORIGINAL[cat]
    if not original_price:
        factors.append(f"No original price given — assumed a typical ₹{DEFAULT_ORIGINAL[cat]:,} for {cat.replace('-', ' ')}")

    years = (age_months or 12) / 12
    dep = (1 - ANNUAL_DEPRECIATION[cat]) ** years
    factors.append(f"{int(ANNUAL_DEPRECIATION[cat] * 100)}%/year depreciation over {years:.1f} years → ×{dep:.2f}")
    cf = CONDITION_FACTOR.get(condition, 0.6)
    factors.append(f"Condition '{condition}' → ×{cf}")
    bf = 1.1 if brand and brand.strip().lower() in PREMIUM_BRANDS else 1.0
    if bf > 1:
        factors.append(f"Well-known brand ({brand}) → ×1.1")

    model_price = max(base * dep * cf * bf, base * FLOOR)

    comps_used = []
    for c in comparables or []:
        price = c.get("price")
        if not price:
            continue
        adj = CONDITION_FACTOR.get(condition, 0.6) / CONDITION_FACTOR.get(c.get("condition") or "Good", 0.7)
        comps_used.append(price * adj)

    if comps_used:
        median = statistics.median(comps_used)
        w = min(0.7, len(comps_used) / 10)
        suggested = (1 - w) * model_price + w * median
        factors.append(f"Blended with {len(comps_used)} similar item(s) sold on ReCircle (median ₹{int(median):,}, weight {int(w * 100)}%)")
        method = "depreciation+comparables"
        spread = max(0.08, 0.2 - 0.012 * len(comps_used))
    else:
        suggested = model_price
        factors.append("No comparable sales yet in this category — using the depreciation model only")
        method = "depreciation-model"
        spread = 0.18

    confidence = round(min(0.9, 0.45 + (0.2 if original_price else 0) + min(0.25, len(comps_used) * 0.03)), 2)
    return {
        "min": _round_price(suggested * (1 - spread)),
        "max": _round_price(suggested * (1 + spread)),
        "suggested": _round_price(suggested),
        "currency": "INR",
        "method": method,
        "factors": factors,
        "comparables_used": len(comps_used),
        "confidence": confidence,
        "provider": method,
        "is_demo": False,
        "limitations": "Indicative range, not a guaranteed market value. Local demand, accessories and bill/warranty can change the price.",
    }

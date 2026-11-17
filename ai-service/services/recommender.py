"""
AI Reuse vs Recycle Recommendation Engine.

An explainable, weighted rule engine. Every rule that fires is returned in `factors`
with the action it supports and its weight, so the UI can show *why*.
The user always makes the final decision.
"""
from __future__ import annotations

from utils.text import contains_any
from services.llm import chat_completion

ACTIONS = ["reuse", "repair", "donate", "recycle"]

# Typical useful life in months, used to judge how "old" an item is for its category.
EXPECTED_LIFE = {
    "laptops": 72, "mobile-phones": 48, "electronics": 84, "home-appliances": 120, "furniture": 144,
    "bicycles": 120, "books": 360, "clothing": 60, "kitchen": 96, "other": 96,
}

CATEGORY_KEYWORDS = {
    "laptops": ["laptop", "notebook", "macbook", "thinkpad", "chromebook"],
    "mobile-phones": ["phone", "mobile", "iphone", "smartphone", "galaxy", "redmi", "oneplus"],
    "electronics": ["tv", "television", "monitor", "speaker", "camera", "ipad", "tablet", "headphone", "console", "router"],
    "home-appliances": ["fridge", "refrigerator", "washing", "microwave", "cooler", "ac", "air conditioner", "geyser", "fan", "iron"],
    "furniture": ["sofa", "table", "chair", "bed", "cupboard", "wardrobe", "shelf", "desk", "almirah"],
    "bicycles": ["cycle", "bicycle", "bike"],
    "books": ["book", "novel", "textbook", "guide"],
    "clothing": ["shirt", "jeans", "jacket", "saree", "kurta", "dress", "shoes", "clothes"],
    "kitchen": ["mixer", "grinder", "cooker", "pan", "utensil", "kettle", "induction", "fryer", "toaster"],
}

BROKEN = ["broken", "not working", "dead", "doesn't work", "does not work", "won't turn on", "faulty", "damaged", "burnt", "water damage"]
FIXABLE = ["screen", "battery", "charger", "puncture", "chain", "brake", "hinge", "leg", "cushion", "zip", "button", "keyboard", "speaker", "tyre", "tire", "wheel", "scratch", "loose"]
BEYOND = ["rusted through", "rotten", "termite", "shattered", "beyond repair", "torn apart", "cracked body", "motherboard", "pcb burnt"]
WORN = ["torn", "stained", "faded", "worn out", "holes"]
DONATE_CATEGORIES = {"books", "clothing", "kitchen", "other"}
LOW_VALUE = {"books", "clothing"}
CONDITION_SCORE = {"New": 1.0, "Like New": 0.9, "Good": 0.7, "Fair": 0.45, "Needs Repair": 0.2}


def suggest_category(text: str, available: list[str] | None = None) -> str:
    best, hits = "other", 0
    for cat, words in CATEGORY_KEYWORDS.items():
        n = len(contains_any(text, words))
        if n > hits:
            best, hits = cat, n
    if available and best not in available:
        return "other" if "other" in available else (available[0] if available else best)
    return best


def estimate_condition(condition: str | None, text: str, is_working: bool | None) -> str:
    if condition:
        return condition
    if is_working is False or contains_any(text, BROKEN):
        return "Needs Repair"
    if contains_any(text, ["new", "sealed", "unused", "unopened"]):
        return "Like New"
    if contains_any(text, WORN + ["scratches", "dent"]):
        return "Fair"
    return "Good"


def recommend(
    title: str = "",
    description: str = "",
    category: str | None = None,
    condition: str | None = None,
    age_months: float | None = None,
    is_working: bool | None = None,
    available_categories: list[str] | None = None,
    has_image: bool = False,
) -> dict:
    text = f"{title} {description}"
    cat = category or suggest_category(text, available_categories)
    cond = estimate_condition(condition, text, is_working)
    life = EXPECTED_LIFE.get(cat, 96)
    age_ratio = (age_months / life) if age_months is not None else None

    scores = {a: 0.0 for a in ACTIONS}
    factors: list[dict] = []

    def add(action: str, weight: float, label: str):
        scores[action] += weight
        factors.append({"action": action, "weight": round(weight, 2), "reason": label})

    cs = CONDITION_SCORE.get(cond, 0.6)
    if cs >= 0.7:
        add("reuse", 2.0 * cs, f"Condition is '{cond}', which buyers value")
    elif cs >= 0.45:
        add("reuse", 0.8, f"Condition '{cond}' is still usable")
        add("donate", 0.6, "Usable but modest resale value — donating is a good option")
    else:
        add("repair", 1.0, f"Condition is '{cond}'")

    broken = contains_any(text, BROKEN) or (["reported as not working"] if is_working is False else [])
    fixable = contains_any(text, FIXABLE)
    beyond = contains_any(text, BEYOND)
    worn = contains_any(text, WORN)

    if broken:
        add("repair", 1.2, f"Description mentions a fault ({', '.join(broken[:2])})")
        scores["reuse"] -= 1.0
    if fixable:
        add("repair", 1.0 if broken else 0.4, f"Issue looks fixable ({', '.join(fixable[:3])})")
    if beyond:
        add("recycle", 2.2, f"Damage sounds beyond economical repair ({', '.join(beyond[:2])})")
        scores["repair"] -= 0.8
    if worn:
        scores["donate"] -= 0.8  # charities can't use torn/stained items
        scores["reuse"] -= 0.5
        if cat == "clothing":
            add("recycle", 1.2, "Worn-out textiles are better recycled into fibre")

    if age_ratio is not None:
        if age_ratio < 0.4:
            add("reuse", 1.0, f"Only {int(age_months)} months old for a {cat.replace('-', ' ')} item")
        elif age_ratio < 0.8:
            add("reuse", 0.4, "Still within its typical useful life")
        elif age_ratio < 1.2:
            add("donate", 0.5, "Near the end of typical useful life; value is mostly in use, not resale")
            if broken:
                add("recycle", 0.6, "Old and faulty — repair may cost more than the item is worth")
        else:
            add("recycle", 1.0 if broken else 0.5, "Older than the typical useful life for its category")
            if not broken:
                add("donate", 0.4, "Old but working items are often welcome as donations")

    if cat in DONATE_CATEGORIES and cs >= 0.45 and not broken and not worn:
        add("donate", 0.7, f"{cat.title()} in usable condition are commonly donated")
    if cat in LOW_VALUE and cs < 0.7 and not broken and not worn:
        add("donate", 0.8, f"Fair-condition {cat} rarely sell for much — donating gets them used quickly")
    if cat in {"laptops", "mobile-phones", "electronics", "home-appliances"} and (broken and not fixable):
        add("recycle", 0.7, "Electronics with unknown faults should go to an authorised e-waste recycler if repair is not viable")

    if not has_image:
        factors.append({"action": None, "weight": 0, "reason": "No photo provided — recommendation is based on your description only"})

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best, best_score = ranked[0]
    second = ranked[1][1]
    total_pos = sum(max(v, 0) for v in scores.values()) or 1
    confidence = round(min(0.95, max(0.35, 0.5 * (max(best_score, 0) / total_pos) + 0.5 * min(1.0, (best_score - second) / 2 + 0.3))), 2)

    top_reasons = [f["reason"] for f in factors if f["action"] == best][:3]
    pretty = {"reuse": "List it on the second-hand marketplace", "repair": "Repair it before resale", "donate": "Donate it", "recycle": "Book a kabadiwala for recycling"}
    reason = f"{pretty[best]}: " + "; ".join(top_reasons) + "." if top_reasons else pretty[best] + "."

    provider = "rules"
    explanation = chat_completion([
        {"role": "system", "content": "You explain a recommendation to an Indian household user in 2 short friendly sentences. Do not change the recommendation."},
        {"role": "user", "content": f"Item: {title}. Details: {description}. Recommendation: {best}. Reasons: {top_reasons}."},
    ], max_tokens=120)
    if explanation:
        provider = "rules+llm"

    return {
        "action": best,
        "reason": reason,
        "explanation": explanation,
        "suggested_category": cat,
        "estimated_condition": cond,
        "confidence": confidence,
        "scores": {k: round(v, 2) for k, v in scores.items()},
        "factors": factors,
        "provider": provider,
        "is_demo": False,
        "limitations": "Rule-based recommendation using your description, condition and age. It does not inspect the photo for damage.",
    }

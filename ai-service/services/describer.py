"""Product description generator: LLM when configured, otherwise a structured template."""
from __future__ import annotations

from services.llm import chat_completion

CONDITION_PHRASE = {
    "New": "brand new and unused",
    "Like New": "in like-new condition with barely any signs of use",
    "Good": "in good working condition with light, normal signs of use",
    "Fair": "fully usable, with visible wear that is reflected in the price",
    "Needs Repair": "in need of a repair, priced accordingly — ideal for someone handy",
}


def _age_text(age_months):
    if age_months is None:
        return None
    m = int(age_months)
    if m < 12:
        return f"{m} month{'s' if m != 1 else ''} old"
    y, rem = divmod(m, 12)
    return f"about {y} year{'s' if y > 1 else ''}{' and ' + str(rem) + ' months' if rem >= 3 else ''} old"


def template(title, category=None, brand=None, condition=None, age_months=None, features=None, notes=None) -> str:
    features = [f.strip() for f in (features or []) if f and f.strip()]
    parts = []
    lead = f"Selling my {brand + ' ' if brand and brand.lower() not in title.lower() else ''}{title}"
    if condition:
        lead += f", {CONDITION_PHRASE.get(condition, condition.lower())}"
    parts.append(lead + ".")
    age = _age_text(age_months)
    if age:
        parts.append(f"It is {age}.")
    if features:
        parts.append("\n\nHighlights:\n" + "\n".join(f"• {f}" for f in features[:8]))
    if notes:
        parts.append(f"\n\n{notes.strip()}")
    parts.append("\n\nYou're welcome to inspect it before buying. Giving it a second life instead of letting it go to waste — message me through ReCircle to arrange a viewing.")
    return " ".join(parts).replace(" \n", "\n").strip()


def generate(title, category=None, brand=None, condition=None, age_months=None, features=None, notes=None) -> dict:
    llm_text = chat_completion([
        {
            "role": "system",
            "content": (
                "You write honest, attractive second-hand product listings for an Indian marketplace. "
                "120-160 words, friendly, no exaggeration, no invented specs, mention condition honestly, "
                "end with an invitation to inspect. Use bullet points for features. Do not include phone numbers."
            ),
        },
        {"role": "user", "content": f"Title: {title}\nCategory: {category}\nBrand: {brand}\nCondition: {condition}\nAge (months): {age_months}\nFeatures: {features}\nSeller notes: {notes}"},
    ], max_tokens=350, temperature=0.6)
    if llm_text:
        return {"description": llm_text, "provider": "llm", "is_demo": False, "editable": True}
    return {
        "description": template(title, category, brand, condition, age_months, features, notes),
        "provider": "template",
        "is_demo": True,
        "limitations": "Generated from a template using your details (no LLM configured). Edit freely before publishing.",
        "editable": True,
    }

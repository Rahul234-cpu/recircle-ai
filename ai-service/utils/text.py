"""Small text helpers shared by the rule engines and the chatbot."""
import re

STOPWORDS = {
    "a", "an", "the", "is", "are", "am", "i", "my", "me", "to", "of", "and", "or", "in", "on", "for", "it",
    "can", "do", "does", "how", "what", "which", "who", "when", "where", "why", "be", "with", "this", "that",
    "you", "your", "we", "our", "will", "if", "at", "as", "by", "from", "about", "have", "has", "get", "so",
}

SYNONYMS = {
    "kabadiwala": "collector", "ecopartner": "collector", "ecopartners": "collector", "kabadi": "collector", "scrap": "waste", "raddi": "paper", "pickup": "collection",
    "pick": "collection", "book": "booking", "booked": "booking", "sell": "sell", "selling": "sell", "sold": "sell",
    "price": "rate", "prices": "rate", "rates": "rate", "cost": "rate", "money": "payment", "pay": "payment",
    "paid": "payment", "points": "reward", "rewards": "reward", "eco": "reward", "listing": "listing",
    "listings": "listing", "list": "listing", "product": "listing", "products": "listing", "buy": "purchase",
    "buying": "purchase", "order": "purchase", "orders": "purchase", "password": "account", "login": "account",
    "signup": "account", "register": "account", "cancel": "cancel", "cancelled": "cancel", "weight": "weight",
    "kg": "weight", "plastic": "plastic", "bottles": "bottle", "ewaste": "e-waste", "electronics": "e-waste",
}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9\-]+", (text or "").lower())
    out = []
    for w in words:
        if w in STOPWORDS or len(w) < 2:
            continue
        if w in SYNONYMS:
            w = SYNONYMS[w]
        elif len(w) > 4 and w.endswith("s"):
            # Strip the plural first so "pickups" / "kabadiwalas" also hit their synonym.
            w = SYNONYMS.get(w[:-1], w[:-1])
        if len(w) > 4 and w.endswith("s"):
            w = w[:-1]
        out.append(w)
    return out


def contains_any(text: str, words) -> list[str]:
    t = (text or "").lower()
    return [w for w in words if re.search(rf"\b{re.escape(w)}", t)]

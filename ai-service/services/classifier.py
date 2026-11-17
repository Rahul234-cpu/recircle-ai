"""
Waste image classification.

Live mode  : CLIP zero-shot image classification through the Hugging Face Inference API
             (needs HF_API_TOKEN). CLIP compares the image with text prompts such as
             "a photo of crushed plastic bottles" and returns a probability per prompt.
Demo mode  : a transparent colour/texture heuristic + keyword hints. It is NOT a trained
             model; its confidence is capped and the response says so.
"""
from __future__ import annotations

import base64
import colorsys
import io
import math
import time

from utils.config import settings
from utils.text import contains_any

MATERIALS = ["paper", "cardboard", "plastic", "metal", "glass", "e-waste", "textile", "mixed"]

# Several prompts per material improve CLIP zero-shot accuracy.
CLIP_PROMPTS = {
    "paper": ["a photo of a stack of old newspapers", "a photo of waste paper and magazines", "a photo of old notebooks and books"],
    "cardboard": ["a photo of cardboard boxes", "a photo of flattened corrugated cartons"],
    "plastic": ["a photo of plastic bottles", "a photo of plastic containers and buckets", "a photo of plastic waste"],
    "metal": ["a photo of metal scrap", "a photo of rusty iron scrap", "a photo of aluminium cans", "a photo of steel utensils"],
    "glass": ["a photo of glass bottles", "a photo of glass jars"],
    "e-waste": ["a photo of old electronics", "a photo of broken mobile phones and chargers", "a photo of a circuit board", "a photo of an old appliance"],
    "textile": ["a photo of old clothes", "a photo of fabric and textiles"],
    "mixed": ["a photo of mixed household garbage"],
}

KEYWORDS = {
    "paper": ["newspaper", "paper", "magazine", "book", "notebook", "raddi"],
    "cardboard": ["cardboard", "carton", "box", "boxes", "corrugated"],
    "plastic": ["plastic", "pet", "bottle", "bucket", "container", "polythene"],
    "metal": ["metal", "iron", "steel", "aluminium", "aluminum", "copper", "brass", "can", "tin", "scrap"],
    "glass": ["glass", "jar", "beer", "wine"],
    "e-waste": ["phone", "mobile", "laptop", "charger", "cable", "pcb", "circuit", "electronic", "tv", "monitor", "battery", "appliance", "fridge", "ewaste", "e-waste"],
    "textile": ["cloth", "clothes", "shirt", "fabric", "textile", "saree", "jeans"],
}

DEMO_LIMITATIONS = (
    "Demo classifier: uses colour/texture statistics and words from the file name or your description, "
    "not a trained vision model. Treat the result as a hint and correct the category if it is wrong. "
    "Set HF_API_TOKEN on the AI service to enable CLIP-based classification."
)


def _normalise(scores: dict[str, float]) -> list[dict]:
    total = sum(max(v, 0.0) for v in scores.values()) or 1.0
    preds = [{"material": m, "confidence": round(max(v, 0.0) / total, 3)} for m, v in scores.items()]
    preds.sort(key=lambda p: p["confidence"], reverse=True)
    return preds


def keyword_scores(text: str) -> dict[str, float]:
    scores = {m: 0.0 for m in MATERIALS}
    for material, words in KEYWORDS.items():
        hits = contains_any(text, words)
        scores[material] += 0.6 * len(hits)
    return scores


# ------------------------------------------------------------------ demo heuristic
def image_features(image_bytes: bytes) -> dict:
    from PIL import Image, ImageFilter, ImageStat  # imported lazily

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((96, 96))
    # Pillow ≥12 deprecates getdata() (removal planned for Pillow 14); prefer the replacement when present.
    flat = getattr(img, "get_flattened_data", None)
    pixels = list(flat() if flat else img.getdata())
    n = len(pixels) or 1
    hsv = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in pixels]
    sat = sum(s for _, s, _ in hsv) / n
    val = sum(v for _, _, v in hsv) / n
    val_std = math.sqrt(sum((v - val) ** 2 for _, _, v in hsv) / n)
    # Hue buckets only for reasonably saturated pixels
    coloured = [(h * 360) for h, s, v in hsv if s > 0.18 and v > 0.15]
    frac = lambda lo, hi: (sum(1 for h in coloured if lo <= h < hi) / n)  # noqa: E731
    edges = img.convert("L").filter(ImageFilter.FIND_EDGES)
    edge_density = ImageStat.Stat(edges).mean[0] / 255
    dark = sum(1 for _, _, v in hsv if v < 0.2) / n
    bright_grey = sum(1 for _, s, v in hsv if s < 0.12 and v > 0.7) / n
    return {
        "saturation": sat,
        "brightness": val,
        "brightness_std": val_std,
        "edge_density": edge_density,
        "brown": frac(18, 45),
        "green": frac(75, 165),
        "blue": frac(180, 250),
        "warm": frac(0, 18) + frac(330, 360),
        "dark": dark,
        "bright_grey": bright_grey,
        "hue_spread": len({int(h // 30) for h in coloured}) / 12,
    }


def heuristic_scores(f: dict) -> dict[str, float]:
    s = {m: 0.05 for m in MATERIALS}
    s["cardboard"] += 1.6 * f["brown"] + (0.2 if 0.25 < f["saturation"] < 0.6 else 0)
    s["paper"] += 1.2 * f["bright_grey"] + 1.5 * f["edge_density"] + (0.2 if f["saturation"] < 0.15 else 0)
    s["plastic"] += 1.0 * f["blue"] + 0.4 * f["bright_grey"] + (0.25 if f["brightness"] > 0.6 else 0)
    s["metal"] += (0.5 if f["saturation"] < 0.15 else 0) + 1.2 * f["brightness_std"] + 0.5 * f["warm"] * (f["saturation"] < 0.5)
    s["glass"] += 1.3 * f["green"] + (0.2 if f["brightness_std"] > 0.25 else 0)
    s["e-waste"] += 1.4 * f["dark"] + 0.8 * f["edge_density"] * (f["dark"] > 0.25)
    s["textile"] += 1.0 * f["hue_spread"] + (0.3 if f["saturation"] > 0.45 else 0) + 0.4 * f["warm"]
    s["mixed"] += 0.6 * f["hue_spread"] * (f["edge_density"] > 0.18)
    return s


def classify_demo(image_bytes: bytes, hint_text: str) -> dict:
    try:
        feats = image_features(image_bytes)
        img_scores = heuristic_scores(feats)
    except Exception:  # unreadable image → rely on keywords only
        feats, img_scores = {}, {m: 0.1 for m in MATERIALS}
    kw = keyword_scores(hint_text)
    combined = {m: img_scores[m] + kw[m] for m in MATERIALS}
    preds = _normalise(combined)
    # Cap: the heuristic must never look more certain than it is.
    top = preds[0]
    cap = 0.6 if any(kw.values()) else 0.45
    if top["confidence"] > cap:
        top["confidence"] = cap
    return {
        "material": top["material"],
        "confidence": top["confidence"],
        "predictions": preds[:4],
        "provider": "demo-heuristic",
        "is_demo": True,
        "limitations": DEMO_LIMITATIONS,
        "signals": {
            "keywords_used": [m for m, v in kw.items() if v > 0],
            "image_features": {k: round(v, 3) for k, v in feats.items()},
        },
    }


# ------------------------------------------------------------------ CLIP via Hugging Face
def classify_clip(image_bytes: bytes, hint_text: str) -> dict:
    import httpx  # imported lazily

    labels, label_to_material = [], {}
    for material, prompts in CLIP_PROMPTS.items():
        for p in prompts:
            labels.append(p)
            label_to_material[p] = material

    payload = {"inputs": base64.b64encode(image_bytes).decode(), "parameters": {"candidate_labels": labels}}
    headers = {"Authorization": f"Bearer {settings.hf_api_token}"}
    with httpx.Client(timeout=30) as client:
        for attempt in range(3):
            r = client.post(settings.hf_inference_url, json=payload, headers=headers)
            if r.status_code == 503 and attempt < 2:  # model cold start
                time.sleep(4)
                continue
            r.raise_for_status()
            break
    data = r.json()
    if isinstance(data, dict) and "labels" in data:  # alternate response shape
        data = [{"label": l, "score": s} for l, s in zip(data["labels"], data["scores"])]

    scores = {m: 0.0 for m in MATERIALS}
    for item in data:
        scores[label_to_material.get(item["label"], "mixed")] += float(item["score"])
    # Small nudge from the user's own words (never overrides a confident image result).
    for m, v in keyword_scores(hint_text).items():
        scores[m] += 0.05 * v
    preds = _normalise(scores)
    return {
        "material": preds[0]["material"],
        "confidence": preds[0]["confidence"],
        "predictions": preds[:4],
        "provider": "huggingface-clip",
        "is_demo": False,
        "limitations": "Zero-shot CLIP prediction. Accuracy drops for mixed piles, poor lighting or unusual items — please confirm the category.",
    }


def classify(image_bytes: bytes, filename: str = "", description: str = "") -> dict:
    hint = f"{filename} {description}"
    if settings.vision_enabled:
        try:
            return classify_clip(image_bytes, hint)
        except Exception as exc:  # fall back but say so
            result = classify_demo(image_bytes, hint)
            result["limitations"] = f"Vision API failed ({type(exc).__name__}); fell back to demo heuristic. " + DEMO_LIMITATIONS
            return result
    return classify_demo(image_bytes, hint)

"""Run with:  pytest -q   (from the ai-service folder)"""
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402

from services import chatbot, classifier, describer, pricing, recommender  # noqa: E402


def _img(color, size=(64, 64)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


# ------------------------------------------------------------------ classifier (demo mode)
def test_demo_classifier_is_labelled_and_capped():
    r = classifier.classify_demo(_img((170, 120, 70)), "")
    assert r["provider"] == "demo-heuristic"
    assert r["is_demo"] is True
    assert r["confidence"] <= 0.45
    assert "limitations" in r


def test_brown_image_leans_cardboard():
    r = classifier.classify_demo(_img((165, 120, 75)), "")
    assert r["material"] == "cardboard"


def test_keywords_steer_prediction():
    r = classifier.classify_demo(_img((200, 200, 200)), "old plastic bottles.jpg")
    assert r["material"] == "plastic"
    assert r["confidence"] <= 0.6


def test_unreadable_image_does_not_crash():
    r = classifier.classify_demo(b"not an image at all", "newspaper bundle")
    assert r["material"] == "paper"


def test_predictions_sum_close_to_one():
    r = classifier.classify_demo(_img((30, 30, 30)), "")
    assert len(r["predictions"]) == 4


# ------------------------------------------------------------------ recommender
def test_good_young_laptop_is_reuse():
    r = recommender.recommend(title="Dell laptop", description="works perfectly", category="laptops", condition="Like New", age_months=12)
    assert r["action"] == "reuse"
    assert r["factors"]


def test_broken_fixable_phone_is_repair():
    r = recommender.recommend(title="Samsung phone", description="screen cracked, not working touch, battery fine", condition="Needs Repair", age_months=20)
    assert r["action"] == "repair"
    assert r["suggested_category"] == "mobile-phones"


def test_old_dead_appliance_is_recycle():
    r = recommender.recommend(title="Old fridge", description="dead, compressor rusted through, beyond repair", category="home-appliances", age_months=200, is_working=False)
    assert r["action"] == "recycle"


def test_worn_clothes_recycle_and_ok_books_donate():
    assert recommender.recommend(title="old shirts", description="torn and stained", category="clothing", condition="Fair", age_months=70)["action"] == "recycle"
    assert recommender.recommend(title="Story books", description="kids story books", category="books", condition="Fair", age_months=60)["action"] == "donate"


def test_category_guess_respects_available():
    assert recommender.suggest_category("blue gear bicycle", ["bicycles", "other"]) == "bicycles"
    assert recommender.suggest_category("random thing", ["other"]) == "other"


# ------------------------------------------------------------------ pricing
def test_price_range_ordering_and_floor():
    r = pricing.estimate(category="laptops", condition="Good", age_months=24, original_price=60000, brand="Dell")
    assert r["min"] < r["suggested"] < r["max"]
    assert r["suggested"] < 60000
    old = pricing.estimate(category="mobile-phones", condition="Needs Repair", age_months=120, original_price=20000)
    assert old["suggested"] >= 20000 * pricing.FLOOR * 0.9


def test_comparables_pull_price():
    base = pricing.estimate(category="bicycles", condition="Good", age_months=24, original_price=10000)
    comps = [{"price": 2000, "condition": "Good"}] * 8
    pulled = pricing.estimate(category="bicycles", condition="Good", age_months=24, original_price=10000, comparables=comps)
    assert pulled["suggested"] < base["suggested"]
    assert pulled["method"] == "depreciation+comparables"


# ------------------------------------------------------------------ describer & chatbot
def test_template_description():
    r = describer.generate("Hero Sprint Cycle", "bicycles", "Hero", "Good", 26, ["21 gears", "Disc brakes"], None)
    assert "21 gears" in r["description"]
    assert r["provider"] == "template"


def test_chatbot_finds_relevant_faq():
    r = chatbot.answer("how is the scrap price calculated per kg?")
    assert r["sources"][0]["id"] == "rate-calculation"
    r2 = chatbot.answer("does the kabadiwala see my address?")
    assert r2["sources"][0]["id"] == "privacy-collector"


def test_chatbot_out_of_scope():
    r = chatbot.answer("who won the cricket match yesterday")
    assert r["sources"] == []

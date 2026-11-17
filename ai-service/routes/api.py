import base64
import binascii

from fastapi import APIRouter, Depends, Header, HTTPException

from models.schemas import ChatRequest, ClassifyRequest, DescribeRequest, PriceRequest, RecommendRequest
from services import chatbot, classifier, describer, pricing, recommender
from utils.config import settings


def require_internal_key(x_internal_key: str = Header(default="")):
    """Only the Node backend may call this service."""
    if x_internal_key != settings.ai_service_key:
        raise HTTPException(status_code=401, detail="Invalid internal key")


router = APIRouter(dependencies=[Depends(require_internal_key)])


def _decode(b64: str) -> bytes:
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="image_base64 is not valid base64")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large")
    return data


@router.post("/classify")
def classify(req: ClassifyRequest):
    return classifier.classify(_decode(req.image_base64), req.filename or "", req.description or "")


@router.post("/recommend")
def recommend(req: RecommendRequest):
    return recommender.recommend(
        title=req.title or "",
        description=req.description or "",
        category=req.category,
        condition=req.condition,
        age_months=req.age_months,
        is_working=req.is_working,
        available_categories=req.available_categories,
        has_image=bool(req.image_base64),
    )


@router.post("/price-estimate")
def price_estimate(req: PriceRequest):
    return pricing.estimate(
        category=req.category,
        condition=req.condition,
        age_months=req.age_months,
        original_price=req.original_price,
        brand=req.brand,
        comparables=[c.model_dump() for c in req.comparables],
        title=req.title,
    )


@router.post("/generate-description")
def generate_description(req: DescribeRequest):
    return describer.generate(req.title, req.category, req.brand, req.condition, req.age_months, req.features, req.notes)


@router.post("/chat")
def chat(req: ChatRequest):
    return chatbot.answer(req.message, [h.model_dump() for h in req.history], req.user_role or "guest")

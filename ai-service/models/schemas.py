"""Pydantic request schemas for the AI service."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Condition = Literal["New", "Like New", "Good", "Fair", "Needs Repair"]


class ClassifyRequest(BaseModel):
    image_base64: str = Field(..., min_length=20, max_length=12_000_000)
    mime_type: Optional[str] = None
    filename: Optional[str] = ""
    description: Optional[str] = ""


class RecommendRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = None
    condition: Optional[Condition] = None
    age_months: Optional[float] = Field(None, ge=0, le=600)
    is_working: Optional[bool] = None
    image_base64: Optional[str] = None
    mime_type: Optional[str] = None
    available_categories: Optional[List[str]] = None


class Comparable(BaseModel):
    price: float
    condition: Optional[str] = None
    age_months: Optional[float] = None
    brand: Optional[str] = None
    original_price: Optional[float] = None


class PriceRequest(BaseModel):
    category: str
    condition: Condition
    age_months: Optional[float] = Field(None, ge=0, le=600)
    original_price: Optional[float] = Field(None, ge=0)
    brand: Optional[str] = None
    title: Optional[str] = None
    comparables: List[Comparable] = []


class DescribeRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    category: Optional[str] = None
    brand: Optional[str] = None
    condition: Optional[Condition] = None
    age_months: Optional[float] = None
    features: List[str] = []
    notes: Optional[str] = None


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=800)
    history: List[ChatTurn] = []
    user_role: Optional[str] = "guest"

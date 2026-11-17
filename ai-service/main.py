"""ReCircle AI — FastAPI microservice.

Run:  uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI

from routes.api import router
from services.chatbot import retriever
from utils.config import settings

app = FastAPI(title="ReCircle AI Service", version="1.0.0", docs_url="/docs")
app.include_router(router)


@app.on_event("startup")
def warm_up():
    retriever()  # build the FAQ index once


@app.get("/health")
def health():
    return {
        "status": "ok",
        "vision": "huggingface-clip" if settings.vision_enabled else "demo-heuristic",
        "llm": settings.llm_model if settings.llm_enabled else "disabled (template/retrieval fallback)",
        "recommendation": "rules",
        "pricing": "depreciation+comparables",
    }

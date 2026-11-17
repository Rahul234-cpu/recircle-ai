"""Thin client for any OpenAI-compatible chat completions endpoint (optional)."""
from __future__ import annotations

from utils.config import settings


def chat_completion(messages: list[dict], max_tokens: int = 400, temperature: float = 0.4) -> str | None:
    """Return the model's text, or None when the LLM is not configured or fails."""
    if not settings.llm_enabled:
        return None
    try:
        import httpx

        r = httpx.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            json={"model": settings.llm_model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
            timeout=settings.llm_timeout,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None

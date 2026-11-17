"""
Support chatbot grounded in the project's own FAQ (data/knowledge_base.json).

Retrieval: TF-IDF cosine similarity over title + tags + answer (pure Python).
Generation: if an LLM is configured, it rephrases ONLY the retrieved passages;
otherwise the best matching FAQ answer is returned verbatim with its source.
"""
from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

from services.llm import chat_completion
from utils.text import tokenize

KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"


class Retriever:
    def __init__(self, entries: list[dict]):
        self.entries = entries
        self.docs = [tokenize(f"{e['title']} {e['title']} {e.get('tags', '')} {e.get('tags', '')} {e['answer']}") for e in entries]
        df = Counter()
        for d in self.docs:
            df.update(set(d))
        n = len(self.docs)
        self.idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        self.vecs = [self._vec(d) for d in self.docs]

    def _vec(self, tokens):
        tf = Counter(tokens)
        v = {t: (1 + math.log(c)) * self.idf.get(t, 0.0) for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    def search(self, query: str, k: int = 3):
        q = self._vec(tokenize(query))
        scored = [(sum(q.get(t, 0) * w for t, w in dv.items()), i) for i, dv in enumerate(self.vecs)]
        scored.sort(reverse=True)
        return [(round(s, 3), self.entries[i]) for s, i in scored[:k] if s > 0]


_retriever: Retriever | None = None


def retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever(json.loads(KB_PATH.read_text(encoding="utf-8")))
    return _retriever


GREETINGS = {"hi", "hello", "hey", "namaste", "hii", "helo"}
THRESHOLD = 0.18


def answer(message: str, history: list[dict] | None = None, user_role: str = "guest") -> dict:
    words = set(message.lower().split())
    if words and words <= GREETINGS | {"there", "!"}:
        return {
            "answer": "Namaste! 👋 I'm the ReCircle assistant. Ask me about selling waste, booking an EcoPartner, listing a used product, buying, eco-points or your account.",
            "sources": [], "suggestions": ["How do I sell my waste?", "How is the waste price calculated?", "How do I sell a used product?"],
            "provider": "retrieval", "confidence": 1.0,
        }

    # Include the previous user turn for short follow-ups like "and for plastic?"
    query = message
    if history and len(tokenize(message)) < 4:
        prev = [h["content"] for h in history if h.get("role") == "user"][-1:]
        query = " ".join(prev + [message])

    hits = retriever().search(query, k=3)
    if not hits or hits[0][0] < THRESHOLD:
        return {
            "answer": "I'm not sure about that one. I can help with waste pickups, rates, selling or buying used products, eco-points and account questions. For anything else, please use Contact Us and our team will help.",
            "sources": [], "suggestions": ["Which waste do you accept?", "How do I become an EcoPartner on ReCircle?", "How do I contact a seller safely?"],
            "provider": "retrieval", "confidence": hits[0][0] if hits else 0.0,
        }

    top_score, top = hits[0]
    context = "\n\n".join(f"[{e['title']}]\n{e['answer']}" for _, e in hits)
    llm = chat_completion([
        {"role": "system", "content": (
            "You are ReCircle AI's support assistant. Answer ONLY using the FAQ context below. "
            "If the context doesn't contain the answer, say you don't know and suggest Contact Us. "
            f"Keep it under 90 words. The user's role is {user_role}.\n\nFAQ context:\n{context}"
        )},
        *[{"role": h["role"], "content": h["content"]} for h in (history or [])[-6:]],
        {"role": "user", "content": message},
    ], max_tokens=220, temperature=0.2)

    return {
        "answer": llm or top["answer"],
        "sources": [{"id": e["id"], "title": e["title"], "score": s} for s, e in hits],
        "suggestions": [e["title"] for _, e in hits[1:3]],
        "provider": "retrieval+llm" if llm else "retrieval",
        "confidence": top_score,
    }

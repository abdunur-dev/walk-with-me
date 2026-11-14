"""Any OpenAI-compatible chat server (for example Ollama at http://ollama:11434/v1).
Small local models are weak in Amharic; use this provider for English."""
from __future__ import annotations

import httpx

from ..config import settings
from ..retrieval import Passage
from .base import TRANSLATE_PROMPT, Answer, ProviderError, build_prompt, parse_json_answer


class LocalProvider:
    name = "local"

    def __init__(self) -> None:
        if not settings.local_llm_model:
            raise ProviderError("LOCAL_LLM_MODEL must be set")

    async def _call(self, system: str, user: str, max_tokens: int) -> str:
        body = {"model": settings.local_llm_model, "max_tokens": max_tokens, "temperature": 0,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        async with httpx.AsyncClient(timeout=settings.provider_timeout) as client:
            r = await client.post(settings.local_llm_url.rstrip("/") + "/chat/completions", json=body)
        if r.status_code != 200:
            raise ProviderError(f"local model returned {r.status_code}")
        return r.json()["choices"][0]["message"]["content"]

    async def answer(self, question: str, lang: str, mode: str, passages: list[Passage]) -> Answer:
        system, user = build_prompt(question, lang, mode, passages)
        obj = parse_json_answer(await self._call(system, user, 600))
        return Answer(answer=obj.get("answer"), citations=[str(c) for c in obj.get("citations") or []],
                      course_terms=obj.get("course_terms") or [], provider=self.name, lang=lang)

    async def translate_query(self, text: str, source: str, target: str) -> str:
        src = "Amharic" if source == "am" else "English"
        return (await self._call(TRANSLATE_PROMPT.format(source=src), text, 60)).strip()[:200]

"""Cloud provider using the official Anthropic Python SDK.

Key from ANTHROPIC_API_KEY, model from ANTHROPIC_MODEL. Neither is hard-coded.
Any failure (timeout, API error, refusal, bad JSON) raises ProviderError, and the chat
service falls back to the offline provider.
"""
from __future__ import annotations

import anthropic

from ..config import settings
from ..retrieval import Passage
from .base import TRANSLATE_PROMPT, Answer, ProviderError, build_prompt, parse_json_answer


class ClaudeProvider:
    name = "claude"

    def __init__(self) -> None:
        if not settings.anthropic_api_key or not settings.anthropic_model:
            raise ProviderError("ANTHROPIC_API_KEY and ANTHROPIC_MODEL must both be set")
        # The 6-second budget is enforced by the chat service; no SDK retries inside it.
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key,
                                               timeout=settings.provider_timeout, max_retries=0)

    async def _call(self, system: str, user: str, max_tokens: int) -> str:
        try:
            resp = await self.client.messages.create(
                model=settings.anthropic_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"effort": "low"},   # short grounded Q&A; keeps latency inside the budget
            )
        except anthropic.APITimeoutError as e:
            raise ProviderError("Anthropic API timed out") from e
        except anthropic.RateLimitError as e:
            raise ProviderError("Anthropic API rate limit") from e
        except anthropic.APIStatusError as e:
            raise ProviderError(f"Anthropic API returned {e.status_code}") from e
        except anthropic.APIConnectionError as e:
            raise ProviderError("cannot reach the Anthropic API") from e
        if resp.stop_reason == "refusal":
            raise ProviderError("model declined the request")
        return "".join(b.text for b in resp.content if b.type == "text")

    async def answer(self, question: str, lang: str, mode: str, passages: list[Passage]) -> Answer:
        system, user = build_prompt(question, lang, mode, passages)
        obj = parse_json_answer(await self._call(system, user, 1024))
        return Answer(answer=obj.get("answer"), citations=[str(c) for c in obj.get("citations") or []],
                      course_terms=obj.get("course_terms") or [], provider=self.name, lang=lang)

    async def translate_query(self, text: str, source: str, target: str) -> str:
        src = "Amharic" if source == "am" else "English"
        out = await self._call(TRANSLATE_PROMPT.format(source=src), text, 256)
        return out.strip()[:200]

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Protocol

from ..retrieval import Passage


@dataclass
class Answer:
    answer: str | None
    citations: list[str] = field(default_factory=list)   # passage ids
    course_terms: list[dict] = field(default_factory=list)
    provider: str = "offline"
    lang: str = "en"
    am_unavailable: bool = False   # learner asked in Amharic, but no verified Amharic text exists


class ProviderError(Exception):
    pass


class AIProvider(Protocol):
    name: str

    async def answer(self, question: str, lang: str, mode: str, passages: list[Passage]) -> Answer: ...

    async def translate_query(self, text: str, source: str, target: str) -> str: ...


SYSTEM_PROMPT = """You are Walk With Me, a study helper inside an online course.
Answer ONLY from the passages provided. Do not use any other knowledge.
If the passages do not contain the answer, return {"answer": null, "citations": [], "course_terms": []}.
Reply with one JSON object and nothing else:
{"answer": "<text>", "citations": ["<passage id>", ...], "course_terms": [{"en": "<English course term>", "am": "<Amharic>"}]}
Every answer must cite at least one passage id from the list. Use plain words and short sentences.
{lang_rule}
{mode_rule}"""

LANG_RULE = {
    "en": "Write the answer in English.",
    "am": "Write the answer in Amharic. After each course term, put the English course term in brackets, "
          "for example: ምናባዊ ረዳት (virtual assistant). List those terms in course_terms.",
}
MODE_RULE = {
    "normal": "Keep the answer under 80 words.",
    "simple": "Simple mode: every sentence has 12 words or fewer. Give one step per line. At most 4 lines.",
}


def build_prompt(question: str, lang: str, mode: str, passages: list[Passage]) -> tuple[str, str]:
    system = SYSTEM_PROMPT.replace("{lang_rule}", LANG_RULE.get(lang, LANG_RULE["en"])) \
                          .replace("{mode_rule}", MODE_RULE.get(mode, MODE_RULE["normal"]))
    blocks = "\n\n".join(f"[{p.id}] {p.title}\n{p.text}" for p in passages)
    user = f"Passages:\n{blocks}\n\nQuestion: {question}"
    return system, user


def parse_json_answer(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw or "", re.S)
    if not m:
        raise ProviderError("model did not return JSON")
    try:
        return json.loads(m.group(0))
    except ValueError as e:
        raise ProviderError(f"bad JSON from model: {e}") from e


TRANSLATE_PROMPT = ("Turn this {source} question into 3 to 8 English search keywords for a course search. "
                    "Reply with the keywords only, separated by spaces.")

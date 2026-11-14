"""No model. Returns the best matching human-written text and its citation. Always available."""
from __future__ import annotations

import re

from ..retrieval import Passage
from .base import Answer


def _simplify(text: str) -> str:
    """Simple mode for offline text: one sentence per line, at most 4 lines."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?።])\s+", text) if p.strip()]
    return "\n".join(parts[:4])


class OfflineProvider:
    name = "offline"

    async def answer(self, question: str, lang: str, mode: str, passages: list[Passage]) -> Answer:
        if not passages:
            return Answer(answer=None, provider=self.name, lang=lang)
        best = passages[0]
        am_unavailable = False
        if best.type == "faq":
            if lang == "am" and best.answer_am:
                text, out_lang = best.answer_am, "am"
            else:
                text, out_lang = best.answer_en or best.text, "en"
                am_unavailable = lang == "am"
        else:
            # Course section or job: quote the passage itself (first sentences).
            sentences = re.split(r"(?<=[.!?])\s+", best.text)
            text = " ".join(sentences[:3]).strip()
            out_lang = "en"
            am_unavailable = lang == "am"
        if mode == "simple":
            text = _simplify(text)
        cites = [best.id]
        # A FAQ entry that belongs to a section also cites the section, so "Take me there" works.
        return Answer(answer=text, citations=cites, provider=self.name, lang=out_lang,
                      course_terms=list(best.term_pairs), am_unavailable=am_unavailable)

    async def translate_query(self, text: str, source: str, target: str) -> str:
        return text

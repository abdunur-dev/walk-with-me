"""The one chat pipeline shared by the web widget, Telegram and SMS.

Fallback chain: configured provider -> on error, invalid citations or timeout -> offline
-> if no passage passes MIN_SCORE -> "not in the course" + offer a person.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date

from . import db, retrieval
from .config import settings
from .normalise_am import has_ethiopic, normalise_question
from .providers.base import Answer, ProviderError
from .providers.offline import OfflineProvider

log = logging.getLogger("wwm.chat")

NOT_IN_COURSE = {
    "en": "That is not in this course. I can ask a person, or look at jobs.",
}
_offline = OfflineProvider()
_provider = None
_provider_error: str | None = None


def get_provider():
    """The configured provider, or the offline one if it cannot be built (missing key, etc.)."""
    global _provider, _provider_error
    if _provider is not None:
        return _provider
    name = settings.ai_provider
    try:
        if name == "claude":
            from .providers.claude import ClaudeProvider
            _provider = ClaudeProvider()
        elif name == "local":
            from .providers.local import LocalProvider
            _provider = LocalProvider()
        else:
            _provider = _offline
    except ProviderError as e:
        _provider_error = str(e)
        log.warning("AI provider %s unavailable (%s); using offline", name, e)
        _provider = _offline
    return _provider


def provider_status() -> dict:
    p = get_provider()
    return {"configured": settings.ai_provider, "active": p.name, "error": _provider_error}


def _citation(p: retrieval.Passage, sections: dict) -> dict:
    if p.type == "job":
        return {"type": "job", "id": p.id, "title": p.title, "url": p.url}
    sec = sections.get(p.section_id) if p.section_id else None
    if sec:
        return {"type": "section", "id": sec["id"], "title": sec["title_en"],
                "url": f'{sec["page_url"]}#{sec["anchor"]}', "anchor": sec["anchor"], "page_url": sec["page_url"]}
    return {"type": "faq", "id": p.id, "title": p.title, "url": p.url}


def _log_question(text: str, lang: str, section_id: str | None, answered: bool) -> None:
    norm = normalise_question(text)
    if not norm:
        return
    with db.tx() as c:
        c.execute("INSERT INTO question_log (day, lang, question_norm, section_id, answered) VALUES (?,?,?,?,?)",
                  (date.today().isoformat(), lang, norm, section_id, int(answered)))


def _store(session_id: str | None, role: str, text: str, lang: str, citations=None, provider=None, offline=False):
    if not session_id:
        return
    with db.tx() as c:
        if not c.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,)).fetchone():
            return
        c.execute("INSERT INTO messages (session_id, role, text, lang, citations, provider, answered_offline) "
                  "VALUES (?,?,?,?,?,?,?)",
                  (session_id, role, text, lang, json.dumps(citations or [], ensure_ascii=False), provider, int(offline)))
        c.execute("UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?", (session_id,))


async def ask(text: str, lang: str = "en", mode: str = "normal", session_id: str | None = None,
              page: dict | None = None, log_question: bool = True) -> dict:
    text = (text or "").strip()[:1000]
    lang = "am" if lang == "am" or has_ethiopic(text) else "en"
    mode = "simple" if mode == "simple" else "normal"
    provider = get_provider()
    _store(session_id, "learner", text, lang)

    # Cross-lingual search: Amharic question -> English keywords (model providers only).
    query = text
    if lang == "am" and provider.name != "offline":
        try:
            kw = await asyncio.wait_for(provider.translate_query(text, "am", "en"), settings.provider_timeout)
            query = f"{text} {kw}"
        except Exception as e:  # noqa: BLE001 - any failure just means we search the original text
            log.info("query translation failed: %s", e)

    passages = retrieval.retrieve(query, k=4)
    best = passages[0] if passages else None
    with db.tx() as c:
        sections = {r["id"]: r for r in c.execute("SELECT * FROM course_sections")}

    if not best or best.score < settings.min_score:
        result = {
            "answer": NOT_IN_COURSE["en"], "lang": "en", "citations": [], "course_terms": [], "action": None,
            "provider": "none", "answered_offline": provider.name == "offline", "handoff_suggested": True,
            "not_in_course": True, "am_unavailable": False,
        }
        if log_question:
            _log_question(text, lang, None, False)
        _store(session_id, "helper", result["answer"], "en", [], "none", False)
        return result

    allowed = {p.id for p in passages}
    ans: Answer | None = None
    fell_back = False
    if provider.name != "offline":
        try:
            ans = await asyncio.wait_for(provider.answer(text, lang, mode, passages), settings.provider_timeout)
            if ans.answer is None:
                ans = None  # model says the passages do not answer it -> offline decides below
            elif not ans.citations or any(c not in allowed for c in ans.citations):
                log.warning("rejected %s answer: citations %s not in %s", provider.name, ans.citations, allowed)
                ans, fell_back = None, True
        except (ProviderError, asyncio.TimeoutError, Exception) as e:  # noqa: BLE001
            log.warning("provider %s failed: %s", provider.name, e)
            ans, fell_back = None, True
    if ans is None:
        ans = await _offline.answer(text, lang, mode, passages)

    by_id = {p.id: p for p in passages}
    cited = [by_id[c] for c in ans.citations if c in by_id]
    citations, seen = [], set()
    for p in cited:
        cit = _citation(p, sections)
        if cit["id"] not in seen:
            seen.add(cit["id"])
            citations.append(cit)
    top = cited[0] if cited else best
    action = {"id": top.action_id} if top.action_id else None
    terms = ans.course_terms or []
    if top.section_id and top.section_id in sections and not terms:
        terms = db.jl(sections[top.section_id]["term_pairs"])

    result = {
        "answer": ans.answer, "lang": ans.lang, "citations": citations, "course_terms": terms, "action": action,
        "provider": ans.provider, "answered_offline": ans.provider == "offline",
        "fell_back": fell_back, "handoff_suggested": False, "not_in_course": False,
        "am_unavailable": ans.am_unavailable,
    }
    if log_question:
        _log_question(text, lang, top.section_id, True)
    _store(session_id, "helper", ans.answer or "", ans.lang, citations, ans.provider, ans.provider == "offline")
    return result

import asyncio

import pytest

from app.chat_service import ask
from app.providers.base import Answer, ProviderError

IN_COURSE = [
    ("where do I finish this lesson?", "mark_complete"),
    ("how do I mark the lesson as complete", "mark_complete"),
    ("what does a virtual assistant do", None),
    ("what tasks does a VA handle", None),
    ("why is demand for virtual assistants growing", None),
    ("which tools do I need for remote work", None),
    ("what skills do employers ask for", None),
    ("is time management important", None),
    ("will AI replace virtual assistants", None),
    ("what should go in my portfolio", None),
    ("how many portfolio examples should I have", None),
    ("where is the course outline menu", "toggle_sidebar"),
    ("how do I switch to another course", "open_courses_menu"),
    ("where can I see my score", "open_score_details"),
    ("how do I go to the next concept", "open_curriculum_nav"),
    ("can I talk to a person", "open_help"),
    ("what is a password manager used for", None),
    ("ይህን ትምህርት እንዴት ልጨርስ?", "mark_complete"),      # Amharic, from faq.json question_am
    ("ሰው ያናግሩ", "open_help"),                        # starter string "Talk to a person"
    ("what are the key points of this lesson", None),
]
OUT_OF_COURSE = [
    "what is the capital of France",
    "how do I cook injera",
    "who won the football match yesterday",
    "explain quantum physics",
    "what is the exchange rate for dollars",
]


def _is_am(q: str) -> bool:
    return any("ሀ" <= ch <= "፿" for ch in q)


@pytest.mark.parametrize("q,action", IN_COURSE)
def test_in_course_questions_have_citations(client, q, action):
    r = client.post("/v1/chat", json={"text": q, "lang": "am" if _is_am(q) else "en"}).json()
    assert not r["not_in_course"], q
    assert r["answer"]
    assert len(r["citations"]) >= 1
    assert r["provider"] == "offline" and r["answered_offline"]
    if action:
        assert r["action"] and r["action"]["id"] == action


@pytest.mark.parametrize("q", OUT_OF_COURSE)
def test_out_of_course_says_not_in_course(client, q):
    r = client.post("/v1/chat", json={"text": q, "lang": "en"}).json()
    assert r["not_in_course"] and r["handoff_suggested"] and r["citations"] == []


def test_amharic_question_without_verified_answer_says_so(client):
    r = client.post("/v1/chat", json={"text": "ይህን ትምህርት እንዴት ልጨርስ?", "lang": "am"}).json()
    assert r["am_unavailable"] is True and r["lang"] == "en"


def test_section_citation_has_anchor(client):
    r = client.post("/v1/chat", json={"text": "why is demand growing", "lang": "en"}).json()
    c = r["citations"][0]
    assert c["type"] == "section" and c["url"].startswith("/savanna/pages/") and "#wwm-s" in c["url"]


def test_job_question_cites_a_job(client):
    r = client.post("/v1/chat", json={"text": "which jobs are in Adama", "lang": "en"}).json()
    assert r["citations"] and r["citations"][0]["type"] == "job"


class _BadCitations:
    name = "claude"

    async def answer(self, *a, **k):
        return Answer(answer="Made up", citations=["not-a-passage"], provider="claude")

    async def translate_query(self, text, *a):
        return text


class _Boom:
    name = "claude"

    async def answer(self, *a, **k):
        raise ProviderError("down")

    async def translate_query(self, text, *a):
        raise ProviderError("down")


class _Slow:
    name = "claude"

    async def answer(self, *a, **k):
        await asyncio.sleep(10)

    async def translate_query(self, text, *a):
        return text


@pytest.mark.parametrize("prov", [_BadCitations(), _Boom(), _Slow()])
def test_fallback_to_offline(client, monkeypatch, prov):
    import app.chat_service as cs
    monkeypatch.setattr(cs, "_provider", prov)
    monkeypatch.setattr(cs.settings, "provider_timeout", 0.5)
    r = asyncio.run(ask("what skills do employers ask for", "en"))
    assert r["provider"] == "offline" and r["fell_back"] and r["citations"]


def test_valid_model_answer_is_used(client, monkeypatch):
    import app.chat_service as cs

    class Good:
        name = "claude"

        async def answer(self, q, lang, mode, passages):
            return Answer(answer="Clear writing and reliability.", citations=[passages[0].id], provider="claude")

        async def translate_query(self, text, *a):
            return text

    monkeypatch.setattr(cs, "_provider", Good())
    r = asyncio.run(ask("what skills do employers ask for", "en"))
    assert r["provider"] == "claude" and not r["answered_offline"] and r["citations"]

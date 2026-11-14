"""Learner endpoints: sessions, chat, course sections, delete-my-data."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from .. import chat_service, db
from ..common import ApiError, chat_limit, new_id

router = APIRouter(prefix="/v1", tags=["learner"])


class SessionIn(BaseModel):
    channel: Literal["web", "telegram", "sms"] = "web"
    lang: Literal["en", "am"] = "en"
    mode: Literal["normal", "simple"] = "normal"
    session_id: str | None = Field(default=None, max_length=64, description="Reuse an id created on the device")


class SessionOut(BaseModel):
    session_id: str
    expires_at: str


@router.post("/sessions", response_model=SessionOut, summary="Create an anonymous session")
def create_session(body: SessionIn):
    sid = body.session_id or new_id(16)
    expires = db.in_days(7)
    with db.tx() as c:
        c.execute("""INSERT INTO sessions (id, channel, lang, mode, expires_at) VALUES (?,?,?,?,?)
                     ON CONFLICT(id) DO UPDATE SET lang=excluded.lang, mode=excluded.mode, last_seen_at=datetime('now')""",
                  (sid, body.channel, body.lang, body.mode, expires))
        row = c.execute("SELECT expires_at FROM sessions WHERE id = ?", (sid,)).fetchone()
    return {"session_id": sid, "expires_at": row["expires_at"]}


class PageIn(BaseModel):
    url: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=300)
    section_anchor: str | None = Field(default=None, max_length=100)


class ChatIn(BaseModel):
    session_id: str | None = Field(default=None, max_length=64)
    text: str = Field(min_length=1, max_length=1000)
    lang: Literal["en", "am"] = "en"
    mode: Literal["normal", "simple"] = "normal"
    page: PageIn | None = None


@router.post("/chat", summary="Ask a question; answers come only from the course, with citations")
async def chat(body: ChatIn, request: Request):
    chat_limit.check(body.session_id or (request.client.host if request.client else "anon"))
    return await chat_service.ask(body.text, body.lang, body.mode, body.session_id,
                                  body.page.model_dump() if body.page else None)


@router.get("/course/sections", summary="List course sections")
def sections():
    with db.tx() as c:
        rows = c.execute("SELECT id, title_en, title_am, verified_am, anchor, page_url, position FROM course_sections "
                         "ORDER BY course_id, concept_id, position").fetchall()
    return {"items": [{**dict(r), "url": f'{r["page_url"]}#{r["anchor"]}'} for r in rows]}


@router.delete("/me", summary="Delete this learner's session data")
def delete_me(session_id: str):
    with db.tx() as c:
        n = c.execute("DELETE FROM sessions WHERE id = ?", (session_id,)).rowcount
    if not n:
        raise ApiError(404, "session_not_found", "There is no data for that session.", "Nothing to delete.")
    return {"deleted": True}


@router.get("/status", summary="Which AI provider is answering")
def status():
    return {"ai": chat_service.provider_status()}

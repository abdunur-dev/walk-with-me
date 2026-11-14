"""Human help: handoff requests, chat, WebSocket, page snapshots, staff console."""
from __future__ import annotations

import json
import re
from typing import Literal

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .. import db, services
from ..common import PHONE_FIX, ApiError, handoff_limit, hub, require_staff, staff_from_token, to_e164

router = APIRouter(prefix="/v1", tags=["human help"])


class PlaceIn(BaseModel):
    page_title: str | None = Field(default=None, max_length=300)
    page_url: str | None = Field(default=None, max_length=500)
    section: str | None = Field(default=None, max_length=300)
    focused: str | None = Field(default=None, max_length=300)
    last_error: str | None = Field(default=None, max_length=500)
    recent_messages: list[str] = Field(default_factory=list, max_length=3)
    note: str | None = Field(default=None, max_length=1000, description="What the learner added in their own words")


class HandoffIn(BaseModel):
    session_id: str = Field(max_length=64)
    contact_pref: Literal["chat", "voice_callback", "phone_callback"] = "chat"
    place: PlaceIn
    callback_phone: str | None = Field(default=None, max_length=30)


def _get(handoff_id: str) -> dict:
    with db.tx() as c:
        row = c.execute("SELECT * FROM handoff_requests WHERE id = ?", (handoff_id,)).fetchone()
    if not row:
        raise ApiError(404, "handoff_not_found", "That help request does not exist.", "Press Talk to a person to start a new one.")
    return dict(row)


def _check_learner(h: dict, session_id: str | None) -> None:
    if not session_id or session_id != h["session_id"]:
        raise ApiError(403, "not_your_request", "This help request belongs to another session.", "Start a new request.")


def _messages(handoff_id: str, after: int = 0) -> list[dict]:
    with db.tx() as c:
        return [dict(r) for r in c.execute("SELECT * FROM handoff_messages WHERE handoff_id=? AND id>? ORDER BY id",
                                           (handoff_id, after))]


@router.post("/handoff", summary="Open a human help request (the learner has previewed the place message)")
async def create_handoff(body: HandoffIn):
    handoff_limit.check(body.session_id)
    with db.tx() as c:
        if not c.execute("SELECT 1 FROM sessions WHERE id = ?", (body.session_id,)).fetchone():
            raise ApiError(400, "session_not_found", "This help panel lost its session.", "Close the panel and open it again.")
    phone = None
    if body.contact_pref != "chat":
        phone = to_e164(body.callback_phone or "")
        if not phone:
            raise ApiError(422, "invalid_phone", "That phone number is not in a format we can call.", PHONE_FIX)
    return await services.create_handoff(body.session_id, body.contact_pref, body.place.model_dump(), phone)


@router.get("/handoff/{handoff_id}", summary="Read a help request and its messages (learner)")
def read_handoff(handoff_id: str, session_id: str, after: int = 0):
    h = _get(handoff_id)
    _check_learner(h, session_id)
    with db.tx() as c:
        c.execute("UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?", (session_id,))
        share_req = c.execute("SELECT action FROM share_events WHERE handoff_id=? ORDER BY id DESC LIMIT 1",
                              (handoff_id,)).fetchone()
    return {"id": h["id"], "status": h["status"], "position": services.queue_position(handoff_id),
            "created_at": h["created_at"], "messages": _messages(handoff_id, after),
            "share_requested": bool(share_req and share_req["action"] == "requested")}


class MessageIn(BaseModel):
    session_id: str | None = Field(default=None, max_length=64)
    text: str = Field(min_length=1, max_length=2000)


@router.post("/handoff/{handoff_id}/messages", summary="Learner sends a chat message")
async def learner_message(handoff_id: str, body: MessageIn):
    h = _get(handoff_id)
    _check_learner(h, body.session_id)
    if h["status"] in ("resolved", "abandoned"):
        raise ApiError(409, "handoff_closed", "This chat has ended.", "Press Talk to a person to start a new one.")
    return await services.add_handoff_message(handoff_id, "learner", body.text)


class HelpfulIn(BaseModel):
    session_id: str = Field(max_length=64)
    helpful: bool


@router.post("/handoff/{handoff_id}/helpful", summary="Learner says whether the help was useful")
def helpful(handoff_id: str, body: HelpfulIn):
    h = _get(handoff_id)
    _check_learner(h, body.session_id)
    with db.tx() as c:
        c.execute("UPDATE handoff_requests SET helpful=? WHERE id=?", (int(body.helpful), handoff_id))
    return {"ok": True}


class EndIn(BaseModel):
    session_id: str = Field(max_length=64)


@router.post("/handoff/{handoff_id}/end", summary="Learner closes the request")
async def learner_end(handoff_id: str, body: EndIn):
    h = _get(handoff_id)
    _check_learner(h, body.session_id)
    if h["status"] in ("open", "claimed"):
        await services.set_handoff_status(handoff_id, "abandoned" if h["status"] == "open" else "resolved")
    return {"ok": True}


class ShareEventIn(BaseModel):
    session_id: str = Field(max_length=64)
    kind: Literal["snapshot", "screen"]
    action: Literal["accepted", "declined", "started", "updated", "stopped"]


@router.post("/handoff/{handoff_id}/share-events", summary="Log a share consent event (time only, no content)")
async def share_event(handoff_id: str, body: ShareEventIn):
    h = _get(handoff_id)
    _check_learner(h, body.session_id)
    with db.tx() as c:
        c.execute("INSERT INTO share_events (handoff_id, kind, action) VALUES (?,?,?)", (handoff_id, body.kind, body.action))
        if body.action in ("accepted", "declined", "started"):
            purpose = "page_snapshot" if body.kind == "snapshot" else "screen_share"
            c.execute("INSERT INTO consent_log (session_id, purpose, granted) VALUES (?,?,?)",
                      (body.session_id, purpose, int(body.action != "declined")))
    if body.action == "stopped":
        hub.clear(handoff_id)
    await hub.send(handoff_id, {"type": "share", "kind": body.kind, "action": body.action}, to="staff")
    return {"ok": True}


class SnapshotIn(BaseModel):
    session_id: str = Field(max_length=64)
    handoff_id: str = Field(max_length=64)
    html: str = Field(max_length=400_000)
    title: str | None = Field(default=None, max_length=300)


_PAIRED = re.compile(r"<\s*(script|style|iframe|object|embed|noscript|template)\b[^>]*>.*?<\s*/\s*\1\s*>", re.I | re.S)
_SINGLE = re.compile(r"<\s*/?\s*(script|iframe|object|embed|link|meta|base|frame|frameset)\b[^>]*>", re.I)
_ON_ATTR = re.compile(r"\s(on\w+|srcdoc|formaction)\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.I)
_JS_URL = re.compile(r"(href|src|action)\s*=\s*([\"'])\s*javascript:[^\"']*\2", re.I)


def sanitise_snapshot(html: str) -> str:
    """Belt and braces: the widget already sanitises; the console also renders in sandbox=""."""
    html = _SINGLE.sub("", _PAIRED.sub("", html))
    html = _ON_ATTR.sub("", html)
    return _JS_URL.sub(r'\1="#"', html)


@router.post("/share/snapshot", summary="Learner sends a read-only page snapshot (needs an open request)")
async def snapshot(body: SnapshotIn):
    h = _get(body.handoff_id)
    _check_learner(h, body.session_id)
    if h["status"] not in ("open", "claimed"):
        raise ApiError(409, "handoff_closed", "This chat has ended.", "Start a new request to share your page.")
    hub.snapshots[body.handoff_id] = {"html": sanitise_snapshot(body.html), "title": body.title, "at": db.now_iso()}
    with db.tx() as c:
        c.execute("INSERT INTO share_events (handoff_id, kind, action) VALUES (?, 'snapshot', 'updated')", (body.handoff_id,))
    await hub.send(body.handoff_id, {"type": "snapshot", "at": hub.snapshots[body.handoff_id]["at"]}, to="staff")
    return {"ok": True}


@router.websocket("/handoff/{handoff_id}/ws")
async def handoff_ws(ws: WebSocket, handoff_id: str, session_id: str | None = None, token: str | None = None):
    """Live chat and WebRTC signalling. Learners pass session_id; staff pass token."""
    with db.tx() as c:
        row = c.execute("SELECT session_id FROM handoff_requests WHERE id = ?", (handoff_id,)).fetchone()
    who = None
    if row and session_id and session_id == row["session_id"]:
        who = "learner"
    elif row and staff_from_token(token):
        who = "staff"
    if not who:
        await ws.close(code=4403)
        return
    await ws.accept()
    await hub.join(handoff_id, ws, who)
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            if kind == "message" and isinstance(msg.get("text"), str) and msg["text"].strip():
                await services.add_handoff_message(handoff_id, "learner" if who == "learner" else "staff", msg["text"])
            elif kind == "typing":
                await hub.send(handoff_id, {"type": "typing", "from": who}, to="staff" if who == "learner" else "learner")
            elif kind == "signal":  # WebRTC offer/answer/candidate relay; content is not stored
                await hub.send(handoff_id, {"type": "signal", "from": who, "data": msg.get("data")},
                               to="staff" if who == "learner" else "learner")
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        pass
    finally:
        await hub.leave(handoff_id, ws, who)


# ───────── Staff console ─────────
@router.get("/staff/me", tags=["staff"], summary="Check the staff token")
def staff_me(staff: dict = Depends(require_staff)):
    return staff


@router.get("/staff/handoffs", tags=["staff"], summary="Queue: open requests oldest first, then mine")
def staff_list(staff: dict = Depends(require_staff)):
    with db.tx() as c:
        rows = c.execute("""SELECT h.id, h.status, h.contact_pref, h.created_at, h.claimed_by, h.place_json,
                   CAST((julianday('now') - julianday(h.created_at)) * 86400 AS INTEGER) AS waiting_seconds,
                   s.lang FROM handoff_requests h JOIN sessions s ON s.id = h.session_id
                   WHERE h.status IN ('open','claimed') ORDER BY h.status = 'claimed', h.created_at ASC""").fetchall()
    items = []
    for r in rows:
        place = json.loads(r["place_json"])
        items.append({"id": r["id"], "status": r["status"], "contact_pref": r["contact_pref"], "created_at": r["created_at"],
                      "waiting_seconds": r["waiting_seconds"], "mine": r["claimed_by"] == staff["id"], "lang": r["lang"],
                      "page_title": place.get("page_title"), "section": place.get("section")})
    return {"items": items}


@router.get("/staff/handoffs/{handoff_id}", tags=["staff"], summary="One request: place message, chat, snapshot")
def staff_detail(handoff_id: str, after: int = 0, staff: dict = Depends(require_staff)):
    h = _get(handoff_id)
    place = json.loads(h["place_json"])
    snap = hub.snapshots.get(handoff_id)
    return {"id": h["id"], "status": h["status"], "contact_pref": h["contact_pref"], "callback_phone": h["callback_phone"],
            "created_at": h["created_at"], "claimed_by_me": h["claimed_by"] == staff["id"], "place": place,
            "place_text": services.place_text(place), "messages": _messages(handoff_id, after),
            "snapshot": snap}


@router.post("/staff/handoffs/{handoff_id}/claim", tags=["staff"])
async def staff_claim(handoff_id: str, staff: dict = Depends(require_staff)):
    h = _get(handoff_id)
    if h["status"] != "open":
        raise ApiError(409, "already_claimed", "Someone else has this request.", "Pick another request from the list.")
    await services.set_handoff_status(handoff_id, "claimed", staff["id"])
    await services.add_handoff_message(handoff_id, "system", f"{staff['display_name']} joined the chat.")
    return {"ok": True}


class StaffMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/staff/handoffs/{handoff_id}/messages", tags=["staff"])
async def staff_message(handoff_id: str, body: StaffMessageIn, staff: dict = Depends(require_staff)):
    h = _get(handoff_id)
    if h["status"] in ("resolved", "abandoned"):
        raise ApiError(409, "handoff_closed", "This request is closed.", "Pick another request.")
    msg = await services.add_handoff_message(handoff_id, "staff", body.text)
    from ..telegram import bot as tg
    await tg.relay_to_learner(handoff_id, body.text)
    return msg


@router.post("/staff/handoffs/{handoff_id}/request-share", tags=["staff"], summary="Ask the learner to share (they decide)")
async def staff_request_share(handoff_id: str, staff: dict = Depends(require_staff)):
    _get(handoff_id)
    with db.tx() as c:
        c.execute("INSERT INTO share_events (handoff_id, kind, action) VALUES (?, 'snapshot', 'requested')", (handoff_id,))
    await hub.send(handoff_id, {"type": "share_request"}, to="learner")
    return {"ok": True}


_PII_NOTE = re.compile(r"(\+?\d[\d\s-]{6,}\d)|([\w.+-]+@[\w-]+\.\w+)")


class ResolveIn(BaseModel):
    note: str | None = Field(default=None, max_length=140)


@router.post("/staff/handoffs/{handoff_id}/resolve", tags=["staff"], summary="Resolve; the call-back number is deleted")
async def staff_resolve(handoff_id: str, body: ResolveIn | None = None, staff: dict = Depends(require_staff)):
    _get(handoff_id)
    note = (body.note if body else None) or None
    if note and _PII_NOTE.search(note):
        raise ApiError(422, "note_has_personal_data", "The note looks like it has a phone number or email.",
                       "Remove personal details. Describe the problem only.")
    await services.add_handoff_message(handoff_id, "system", "Chat ended. Was this helpful?")
    await services.set_handoff_status(handoff_id, "resolved", note=note)
    return {"ok": True}

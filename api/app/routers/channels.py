"""SMS inbound webhook and simulator outbox; Telegram webhook."""
from __future__ import annotations

import re

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from .. import chat_service, db, services
from ..common import ApiError, new_id, phone_hash, sms_limit, to_e164
from ..sms.gateway import get_gateway
from ..sms.mock import OUTBOX

router = APIRouter(prefix="/v1", tags=["channels"])

SMS_MENU = "Send HELP, JOBS, ALERT or ASK."


class SmsIn(BaseModel):
    # Accepts the simulator's JSON shape; real gateways can be mapped here (Africa's Talking posts from/text).
    from_: str = Field(alias="from", max_length=30)
    text: str = Field(max_length=480)

    model_config = {"populate_by_name": True}


def _session_for_phone(phone: str) -> str:
    ref = phone_hash(phone)
    with db.tx() as c:
        row = c.execute("SELECT id FROM sessions WHERE channel='sms' AND channel_ref=? AND expires_at > datetime('now')",
                        (ref,)).fetchone()
        if row:
            return row["id"]
        sid = new_id(16)
        c.execute("INSERT INTO sessions (id, channel, channel_ref, lang, expires_at) VALUES (?,?,?,?,?)",
                  (sid, "sms", ref, "en", db.in_days(7)))
        return sid


def _short(text: str, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


async def handle_sms(phone: str, text: str) -> str:
    words = text.strip().split()
    cmd = words[0].upper() if words else ""
    rest = words[1:]
    if cmd in ("YES", "Y") or (cmd.isdigit() and len(cmd) == 6):
        with db.tx() as c:
            row = c.execute("SELECT code FROM alert_confirmations WHERE channel='sms' AND address=? ORDER BY created_at DESC",
                            (phone,)).fetchone()
        code = cmd if cmd.isdigit() else (row["code"] if row else None)
        res = services.confirm_alert(code, phone, "sms") if code else None
        if not res:
            return "No alert is waiting. " + SMS_MENU
        return f"Alerts on: {res['category']} jobs in {res['city']}. Reply STOP to end."
    if cmd == "STOP":
        services.stop_alerts("sms", phone)
        return "Alerts stopped."
    if cmd == "HELP":
        sid = _session_for_phone(phone)
        await services.create_handoff(sid, "phone_callback", {"page_title": "SMS", "section": None,
                                      "focused": None, "last_error": None, "recent_messages": []}, phone)
        return "A person will call you. Reply with your number if different."
    if cmd in ("JOBS", "ALERT"):
        cat = services.match_category(rest[0]) if rest else None
        city = services.match_city(" ".join(rest[1:] if cat else rest)) if rest else None
        if cmd == "JOBS":
            jobs = services.list_jobs(cat, city, limit=3)
            if not jobs:
                return "No jobs match. Try JOBS driver adama, or ALERT to hear about new ones."
            return _short(" / ".join(f"{j['title']}, {j['city']}, by {j['deadline']}" for j in jobs) + ". Sample jobs.", 300)
        services.create_pending_alert("sms", cat or "any", city or "any", [], "en", phone)
        return f"Alerts for {cat or 'any'} jobs in {city or 'any city'}. Reply YES to confirm."
    if cmd == "ASK" and rest:
        sid = _session_for_phone(phone)
        res = await chat_service.ask(" ".join(rest), "en", "simple", sid)
        if res["not_in_course"]:
            return "That is not in the course. Send HELP for a person."
        src = res["citations"][0]["title"] if res["citations"] else ""
        return _short(f"{res['answer']} (From: {src})" if src else res["answer"], 300)
    return SMS_MENU


@router.post("/sms/inbound", summary="Inbound SMS webhook (and the simulator)")
async def sms_inbound(body: SmsIn):
    phone = to_e164(body.from_)
    if not phone:
        raise ApiError(422, "invalid_phone", "That sender number is not an Ethiopian mobile number.", "Use 09… or 07… numbers.")
    sms_limit.check(phone)
    reply = await handle_sms(phone, body.text)
    await get_gateway().send(phone, reply)
    return {"reply": reply}


@router.get("/sms/outbox", summary="Messages the mock gateway would have sent (simulator only)")
def sms_outbox(to: str | None = None):
    phone = to_e164(to) if to else None
    items = [m for m in OUTBOX if not phone or m["to"] == phone]
    return {"gateway": get_gateway().name, "items": items[-50:]}


@router.post("/telegram/webhook", summary="Telegram webhook (production mode)")
async def telegram_webhook(request: Request):
    from ..telegram import bot as tg
    await tg.feed_webhook(await request.json())
    return {"ok": True}

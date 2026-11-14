"""Jobs, alerts, interview accommodation drafts, teacher view."""
from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .. import db, services
from ..common import PHONE_FIX, ApiError, require_staff, subscribe_limit, to_e164
from ..config import settings
from ..retrieval import CATEGORIES, CITIES, SUPPORT_LABELS
from ..sms.gateway import get_gateway

router = APIRouter(prefix="/v1", tags=["jobs"])

CATEGORY_LABELS = {"driver": "Driver", "customer-support": "Customer support", "data-entry": "Data entry",
                   "teaching-assistant": "Teaching assistant", "sales": "Sales", "admin": "Office and admin",
                   "virtual-assistant": "Virtual assistant", "retail": "Shop and retail"}


@router.get("/jobs/meta", summary="Filter values: job types, cities, supports (with plain labels)")
def jobs_meta():
    return {"categories": [{"id": c, "label": CATEGORY_LABELS[c]} for c in CATEGORIES],
            "cities": CITIES, "supports": [{"id": k, "label": v} for k, v in SUPPORT_LABELS.items()]}


@router.get("/jobs", summary="List jobs. ?format=jsonld returns schema.org JobPosting")
def jobs(category: str | None = None, city: str | None = None, supports: str | None = Query(default=None,
         description="Comma-separated support tags; every one must be offered"), format: Literal["json", "jsonld"] = "json"):
    need = [s for s in (supports or "").split(",") if s]
    items = services.list_jobs(category, city, need)
    if format == "jsonld":
        return [services.job_jsonld(j) for j in items]
    return {"items": items, "count": len(items)}


@router.get("/jobs/{job_id}", summary="One job")
def job(job_id: str):
    with db.tx() as c:
        r = c.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not r:
        raise ApiError(404, "job_not_found", "That job does not exist or was removed.", "Go back to the job list.")
    return services.job_dict(r)


class SubscribeIn(BaseModel):
    channel: Literal["telegram", "sms"]
    phone: str | None = Field(default=None, max_length=30)
    category: str = "any"
    city: str = "any"
    supports_needed: list[str] = Field(default_factory=list, max_length=9)
    lang: Literal["en", "am"] = "en"


@router.post("/alerts/subscribe", tags=["alerts"], summary="Start an alert opt-in. Nothing is sent until it is confirmed")
async def subscribe(body: SubscribeIn, request: Request):
    subscribe_limit.check(request.client.host if request.client else "anon")
    if body.category != "any" and body.category not in CATEGORIES:
        raise ApiError(422, "invalid_category", "That job type is not in the list.", "Choose a job type from the list.")
    if body.city != "any" and body.city not in CITIES:
        raise ApiError(422, "invalid_city", "That city is not in the list.", "Choose a city from the list.")
    if body.channel == "sms":
        phone = to_e164(body.phone or "")
        if not phone:
            raise ApiError(422, "invalid_phone", "That phone number is not in a format we can text.", PHONE_FIX)
        code = services.create_pending_alert("sms", body.category, body.city, body.supports_needed, body.lang, phone)
        await get_gateway().send(phone, f"Walk With Me: your code is {code}. Type it on the jobs page to start job alerts.")
        return {"status": "pending", "channel": "sms", "message": "We sent a 6-digit code by SMS. Type it below."}
    code = services.create_pending_alert("telegram", body.category, body.city, body.supports_needed, body.lang)
    bot = settings.telegram_bot_username
    link = f"https://t.me/{bot}?start={code}" if bot else None
    return {"status": "pending", "channel": "telegram", "code": code, "telegram_link": link,
            "message": "Open the bot and press Start. The bot confirms your alert." if link else
                       "The Telegram bot is not set up on this server. Send /start " + code + " to the bot when it is."}


class ConfirmIn(BaseModel):
    phone: str = Field(max_length=30)
    code: str = Field(min_length=4, max_length=12)


@router.post("/alerts/confirm", tags=["alerts"], summary="Confirm an SMS opt-in with the code")
def confirm(body: ConfirmIn):
    phone = to_e164(body.phone)
    res = services.confirm_alert(body.code, phone, "sms") if phone else None
    if not res:
        raise ApiError(422, "invalid_code", "That code does not match.", "Check the SMS and type the 6 digits again.")
    return {"status": "active", **res}


class UnsubscribeIn(BaseModel):
    channel: Literal["telegram", "sms"]
    address: str = Field(max_length=40, description="Phone number for SMS, chat id for Telegram")


@router.post("/alerts/unsubscribe", tags=["alerts"], summary="Stop all alerts for a phone number or chat")
def unsubscribe(body: UnsubscribeIn):
    addr = to_e164(body.address) if body.channel == "sms" else body.address.strip()
    if not addr:
        raise ApiError(422, "invalid_phone", "That phone number is not in a format we know.", PHONE_FIX)
    n = services.stop_alerts(body.channel, addr)
    return {"stopped": n}


# ───────── Interview accommodation (nothing stored) ─────────
ADJUSTMENTS = {
    "sign_language_interpreter": "a sign language interpreter",
    "step_free": "step-free access to the interview room",
    "written_interview_questions": "the interview questions in writing beforehand",
    "extra_time": "extra time for any test",
    "screen_reader_test": "a test that works with a screen reader",
    "quiet_room": "a quiet room",
    "large_print_materials": "large print materials",
}


class DraftIn(BaseModel):
    job_id: str = Field(max_length=40)
    adjustments: list[str] = Field(default_factory=list, max_length=10)
    other: str | None = Field(default=None, max_length=300)
    lang: Literal["en", "am"] = "en"


@router.post("/accommodation/draft", tags=["accommodation"], summary="Draft the request text. Returns text only; stores nothing")
def draft(body: DraftIn):
    with db.tx() as c:
        r = c.execute("SELECT title, employer, contact_hint FROM jobs WHERE id = ?", (body.job_id,)).fetchone()
    if not r:
        raise ApiError(404, "job_not_found", "That job does not exist.", "Choose a job from the list.")
    items = [ADJUSTMENTS[a] for a in body.adjustments if a in ADJUSTMENTS]
    if body.other and body.other.strip():
        items.append(body.other.strip())
    if not items:
        raise ApiError(422, "no_adjustments", "Choose at least one thing that would help.", "Tick a box, or write in Other.")
    lst = items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
    text_en = (f"Hello,\n\nThank you for inviting me to interview for the {r['title']} role at {r['employer'].rstrip('.')}. "
               f"To do my best at the interview, I would like to ask for {lst}.\n\n"
               f"Please let me know if this is possible, or if you need anything from me.\n\nThank you.")
    return {"text_en": text_en, "subject_en": f"Interview arrangements: {r['title']}",
            # Amharic drafts are not generated: no native speaker has checked a template yet.
            "text_am": None, "am_note": "Amharic draft is not ready yet. A native speaker must write the template first.",
            "contact_hint": r["contact_hint"], "job_title": r["title"], "stored": False}


# ───────── Teacher view ─────────
@router.get("/teacher/top-questions", tags=["teacher"], summary="Questions asked at least K_MIN times in 7 days. No names, no ids")
def top_questions(format: Literal["json", "csv"] = "json", staff: dict = Depends(require_staff)):
    with db.tx() as c:
        rows = c.execute("""SELECT q.question_norm, q.section_id, s.title_en, COUNT(*) AS n,
                                   SUM(1 - q.answered) AS unanswered
                            FROM question_log q LEFT JOIN course_sections s ON s.id = q.section_id
                            WHERE q.day >= date('now','-7 day')
                            GROUP BY q.question_norm, q.section_id HAVING n >= ? ORDER BY n DESC LIMIT 200""",
                         (settings.k_min,)).fetchall()
    items = [{"question": r["question_norm"], "section_id": r["section_id"],
              "section_title": r["title_en"] or "Not in the course", "count": r["n"],
              "not_in_course": r["unanswered"]} for r in rows]
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["question", "section", "count"])
        for i in items:
            w.writerow([i["question"], i["section_title"], i["count"]])
        return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                                 headers={"Content-Disposition": 'attachment; filename="top-questions.csv"'})
    return {"k_min": settings.k_min, "days": 7, "items": items}

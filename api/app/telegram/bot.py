"""Telegram bot (aiogram 3). Same chat service, same citations as the widget.

Runs only when TELEGRAM_BOT_TOKEN is set. Dev: long polling. Production: TELEGRAM_MODE=webhook and
point the bot at {PUBLIC_BASE_URL}/v1/telegram/webhook.
"""
from __future__ import annotations

import asyncio
import logging

from .. import chat_service, db, services
from ..common import new_id
from ..config import settings
from ..retrieval import CITIES, SUPPORT_LABELS

log = logging.getLogger("wwm.telegram")

_bot = None
_dp = None
_task: asyncio.Task | None = None
STATE: dict[int, dict] = {}            # chat id -> {lang, mode, handoff, acc}
STAFF_MSG_TO_HANDOFF: dict[int, str] = {}


def _state(chat_id: int) -> dict:
    return STATE.setdefault(chat_id, {"lang": "en", "mode": "normal", "handoff": None})


def _session(chat_id: int) -> str:
    st = _state(chat_id)
    with db.tx() as c:
        row = c.execute("SELECT id FROM sessions WHERE channel='telegram' AND channel_ref=? AND expires_at > datetime('now')",
                        (str(chat_id),)).fetchone()
        if row:
            c.execute("UPDATE sessions SET lang=?, mode=? WHERE id=?", (st["lang"], st["mode"], row["id"]))
            return row["id"]
        sid = new_id(16)
        c.execute("INSERT INTO sessions (id, channel, channel_ref, lang, mode, expires_at) VALUES (?,?,?,?,?,?)",
                  (sid, "telegram", str(chat_id), st["lang"], st["mode"], db.in_days(7)))
        return sid


async def relay_to_learner(handoff_id: str, text: str) -> None:
    """Staff console message -> learner on Telegram (if the request came from Telegram)."""
    if not _bot:
        return
    with db.tx() as c:
        row = c.execute("""SELECT s.channel, s.channel_ref FROM handoff_requests h JOIN sessions s ON s.id = h.session_id
                           WHERE h.id = ?""", (handoff_id,)).fetchone()
    if row and row["channel"] == "telegram":
        await _bot.send_message(int(row["channel_ref"]), f"Person: {text}")


async def _send(chat_id, text: str) -> bool:
    if not _bot:
        return False
    try:
        await _bot.send_message(int(chat_id), text, disable_web_page_preview=True)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("telegram send failed: %s", e)
        return False


async def _notify_staff(text: str, handoff_id: str) -> None:
    if not _bot or not settings.telegram_staff_chat_id:
        return
    link = f"{settings.public_base_url}/site/staff.html#{handoff_id}"
    msg = await _bot.send_message(int(settings.telegram_staff_chat_id),
                                  f"{text}\n\nOpen the console: {link}\nReply to this message to answer the learner.",
                                  disable_web_page_preview=True)
    STAFF_MSG_TO_HANDOFF[msg.message_id] = handoff_id


def build():
    from aiogram import Bot, Dispatcher, F
    from aiogram.filters import Command, CommandObject, CommandStart
    from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

    bot = Bot(settings.telegram_bot_token)
    dp = Dispatcher()

    def kb(rows):
        return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=t, callback_data=d) for t, d in row]
                                                     for row in rows])

    @dp.message(CommandStart())
    async def start(m: Message, command: CommandObject):
        code = (command.args or "").strip()
        if code:
            res = services.confirm_alert(code, str(m.chat.id), "telegram")
            if res:
                await m.answer(f"Job alerts are on: {res['category']} jobs in {res['city']}. Send /stop to end them.")
                return
            await m.answer("That alert link has expired. Make a new one on the jobs page.")
        await m.answer("Walk With Me. Amharic or English?", reply_markup=kb([[("አማርኛ", "lang:am"), ("English", "lang:en")]]))

    @dp.callback_query(F.data.startswith("lang:"))
    async def set_lang(q: CallbackQuery):
        _state(q.message.chat.id)["lang"] = q.data.split(":")[1]
        await q.message.answer("Normal or Simple answers?", reply_markup=kb([[("Normal", "mode:normal"), ("Simple", "mode:simple")]]))
        await q.answer()

    @dp.callback_query(F.data.startswith("mode:"))
    async def set_mode(q: CallbackQuery):
        _state(q.message.chat.id)["mode"] = q.data.split(":")[1]
        _session(q.message.chat.id)
        await q.message.answer("Ready. Ask a question about your course. /help for a person, /jobs for jobs.")
        await q.answer()

    @dp.message(Command("help"))
    async def help_cmd(m: Message):
        await m.answer("How do you want help?", reply_markup=kb([[("Chat", "help:chat"), ("Call me back", "help:call")]]))

    @dp.callback_query(F.data.startswith("help:"))
    async def help_choice(q: CallbackQuery):
        chat_id = q.message.chat.id
        pref = "chat" if q.data.endswith("chat") else "voice_callback"
        sid = _session(chat_id)
        with db.tx() as c:
            msgs = [r["text"] for r in c.execute("SELECT text FROM messages WHERE session_id=? ORDER BY id DESC LIMIT 3", (sid,))]
        place = {"page_title": "Telegram", "section": None, "focused": None, "last_error": None,
                 "recent_messages": list(reversed(msgs))}
        h = await services.create_handoff(sid, pref, place, None)
        _state(chat_id)["handoff"] = h["id"]
        await q.message.answer(f"This was sent to a person:\n{services.place_text(place)}\n\nYou are number {h['position']} in line. "
                               "While a person is helping, your messages go to them. Send /ai to go back to the helper.")
        await q.answer()

    @dp.message(Command("ai"))
    async def back_to_ai(m: Message):
        _state(m.chat.id)["handoff"] = None
        await m.answer("You are back with the helper. Ask a question.")

    @dp.message(Command("jobs"))
    async def jobs_cmd(m: Message):
        from ..routers.jobs import CATEGORY_LABELS
        rows, row = [], []
        for cid, label in CATEGORY_LABELS.items():
            row.append((label, f"jt:{cid}"))
            if len(row) == 2:
                rows.append(row)
                row = []
        rows.append(row + [("Any", "jt:any")])
        await m.answer("Which job type?", reply_markup=kb(rows))

    @dp.callback_query(F.data.startswith("jt:"))
    async def jobs_type(q: CallbackQuery):
        cat = q.data.split(":")[1]
        rows = [[(c, f"jc:{cat}:{i}") for i, c in enumerate(CITIES[k:k + 2], start=k)] for k in range(0, len(CITIES), 2)]
        rows.append([("Any city", f"jc:{cat}:any")])
        await q.message.answer("Which city?", reply_markup=kb(rows))
        await q.answer()

    @dp.callback_query(F.data.startswith("jc:"))
    async def jobs_city(q: CallbackQuery):
        _, cat, ci = q.data.split(":")
        city = "any" if ci == "any" else CITIES[int(ci)]
        jobs = services.list_jobs(cat, city, limit=3)
        if not jobs:
            text = "No jobs match right now."
        else:
            text = "\n\n".join(f"{j['title']} — {j['employer']}, {j['city']}\n{j['summary_simple']}\nDeadline: {j['deadline']}"
                               f" ({j.get('deadline_ethiopian', {}).get('label_en', '')})\nApply: {j['apply_url']}" for j in jobs)
            text += "\n\n(Sample jobs for the demo.)"
        await q.message.answer(text, reply_markup=kb([[("Get alerts for these", f"ja:{cat}:{ci}")]]),
                               disable_web_page_preview=True)
        await q.answer()

    @dp.callback_query(F.data.startswith("ja:"))
    async def jobs_alert(q: CallbackQuery):
        _, cat, ci = q.data.split(":")
        city = "any" if ci == "any" else CITIES[int(ci)]
        code = services.create_pending_alert("telegram", cat, city, [], _state(q.message.chat.id)["lang"])
        res = services.confirm_alert(code, str(q.message.chat.id), "telegram")
        await q.message.answer(f"Job alerts are on: {res['category']} jobs in {res['city']}. Send /stop to end them.")
        await q.answer()

    @dp.message(Command("alerts"))
    async def alerts_cmd(m: Message):
        subs = services.list_alerts("telegram", str(m.chat.id))
        if not subs:
            await m.answer("You have no job alerts. Send /jobs to set one up.")
            return
        await m.answer("Your alerts:\n" + "\n".join(f"- {s['category']} jobs in {s['city']}" for s in subs) +
                       "\nSend /stop to end all alerts.")

    @dp.message(Command("stop"))
    async def stop_cmd(m: Message):
        n = services.stop_alerts("telegram", str(m.chat.id))
        await m.answer("Alerts stopped." if n else "You had no alerts. Nothing to stop.")

    @dp.message(Command("accommodation"))
    async def acc_cmd(m: Message):
        jobs = services.list_jobs(limit=6)
        await m.answer("Which job is the interview for?",
                       reply_markup=kb([[(j["title"][:40], f"acj:{j['id']}")] for j in jobs]))

    @dp.callback_query(F.data.startswith("acj:"))
    async def acc_job(q: CallbackQuery):
        st = _state(q.message.chat.id)
        st["acc"] = {"job": q.data.split(":")[1], "adj": []}
        from ..routers.jobs import ADJUSTMENTS
        rows = [[(v[:40], f"aca:{k}")] for k, v in ADJUSTMENTS.items()] + [[("Done, write the message", "acd")]]
        await q.message.answer("What would help? Press each one, then Done.", reply_markup=kb(rows))
        await q.answer()

    @dp.callback_query(F.data.startswith("aca:"))
    async def acc_adj(q: CallbackQuery):
        st = _state(q.message.chat.id).get("acc")
        if st is not None:
            a = q.data.split(":")[1]
            st["adj"].remove(a) if a in st["adj"] else st["adj"].append(a)
            await q.answer(f"{len(st['adj'])} chosen")
        else:
            await q.answer()

    @dp.callback_query(F.data == "acd")
    async def acc_done(q: CallbackQuery):
        from ..routers.jobs import DraftIn, draft
        st = _state(q.message.chat.id).pop("acc", None)
        if not st or not st["adj"]:
            await q.message.answer("Choose at least one thing first. Send /accommodation to start again.")
        else:
            d = draft(DraftIn(job_id=st["job"], adjustments=st["adj"]))
            await q.message.answer(f"Copy this and send it{(' to ' + d['contact_hint']) if d['contact_hint'] else ''}:\n\n{d['text_en']}\n\n"
                                   "Nothing was sent. This text is not saved.")
        await q.answer()

    @dp.message(F.reply_to_message & (F.chat.id == (int(settings.telegram_staff_chat_id) if settings.telegram_staff_chat_id else 0)))
    async def staff_reply(m: Message):
        hid = STAFF_MSG_TO_HANDOFF.get(m.reply_to_message.message_id)
        if hid and m.text:
            await services.add_handoff_message(hid, "staff", m.text)
            await relay_to_learner(hid, m.text)

    @dp.message(F.text)
    async def free_text(m: Message):
        st = _state(m.chat.id)
        if st.get("handoff"):
            with db.tx() as c:
                row = c.execute("SELECT status FROM handoff_requests WHERE id=?", (st["handoff"],)).fetchone()
            if row and row["status"] in ("open", "claimed"):
                await services.add_handoff_message(st["handoff"], "learner", m.text)
                await m.answer("Sent to the person. You are talking to a person. Send /ai to go back to the helper.")
                return
            st["handoff"] = None
        sid = _session(m.chat.id)
        res = await chat_service.ask(m.text, st["lang"], st["mode"], sid)
        if res["not_in_course"]:
            await m.answer("That is not in this course. Send /help for a person, or /jobs for jobs.")
            return
        lines = [res["answer"]]
        if res.get("am_unavailable"):
            lines.append("(Amharic answer not ready yet.)")
        for cit in res["citations"][:2]:
            url = cit["url"] if cit["url"].startswith("http") else settings.public_base_url + cit["url"]
            lines.append(f"From: {cit['title']}\n{url}")
        if res["answered_offline"]:
            lines.append("Answered offline.")
        await m.answer("\n\n".join(lines), disable_web_page_preview=True)

    return bot, dp


async def start() -> None:
    global _bot, _dp, _task
    if not settings.telegram_bot_token:
        log.info("TELEGRAM_BOT_TOKEN not set; bot disabled")
        return
    _bot, _dp = build()
    services.notify_staff = _notify_staff
    services.send_telegram = _send
    if settings.telegram_mode == "webhook":
        await _bot.set_webhook(f"{settings.public_base_url}/v1/telegram/webhook")
        log.info("Telegram webhook set")
    else:
        await _bot.delete_webhook(drop_pending_updates=False)
        _task = asyncio.create_task(_dp.start_polling(_bot, handle_signals=False))
        log.info("Telegram long polling started")


async def stop() -> None:
    if _task:
        await _dp.stop_polling()
    if _bot:
        await _bot.session.close()


async def feed_webhook(update: dict) -> None:
    if not _bot:
        return
    from aiogram.types import Update
    await _dp.feed_update(_bot, Update.model_validate(update, context={"bot": _bot}))

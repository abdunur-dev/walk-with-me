"""Jobs, alerts, handoffs and retention, shared by REST, Telegram and SMS."""
from __future__ import annotations

import json
import logging
import secrets
from datetime import date

from . import db
from .common import hub, new_id
from .config import settings
from .jobs.ethiopian_date import label as eth_label
from .jobs.ethiopian_date import to_ethiopian
from .retrieval import CATEGORIES, CITIES, SUPPORT_LABELS

log = logging.getLogger("wwm.services")

# Telegram notifier hooks, set by the bot module when it runs.
notify_staff = None          # async (text, handoff_id) -> None
send_telegram = None         # async (chat_id, text) -> bool


# ───────── Jobs ─────────
def job_dict(r, lang: str = "en") -> dict:
    sup = db.jl(r["supports"])
    d = {k: r[k] for k in ("id", "title", "employer", "category", "city", "summary_simple", "description",
                           "apply_url", "contact_hint", "deadline", "posted_at")}
    d["sample"] = True
    d["supports"] = sup
    d["supports_labels"] = [SUPPORT_LABELS.get(s, s) for s in sup]
    if r["deadline"]:
        g = date.fromisoformat(r["deadline"])
        y, m, dd = to_ethiopian(g)
        d["deadline_ethiopian"] = {"year": y, "month": m, "day": dd, "label_en": eth_label(g, "en"),
                                   "label_am": eth_label(g, "am")}
    return d


def list_jobs(category: str | None = None, city: str | None = None, supports: list[str] | None = None,
              limit: int = 100) -> list[dict]:
    sql, args = "SELECT * FROM jobs WHERE active = 1", []
    if category and category != "any":
        sql += " AND category = ?"
        args.append(category)
    if city and city != "any":
        sql += " AND lower(city) = lower(?)"
        args.append(city)
    sql += " ORDER BY posted_at DESC"
    with db.tx() as c:
        rows = c.execute(sql, args).fetchall()
    need = set(supports or [])
    out = [job_dict(r) for r in rows if need <= set(db.jl(r["supports"]))]
    return out[:limit]


def job_jsonld(j: dict) -> dict:
    """schema.org/JobPosting (adoption Level 3)."""
    return {
        "@context": "https://schema.org", "@type": "JobPosting", "identifier": j["id"], "title": j["title"],
        "description": j["description"], "datePosted": j["posted_at"][:10], "validThrough": j.get("deadline"),
        "hiringOrganization": {"@type": "Organization", "name": j["employer"]},
        "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": j["city"],
                                                       "addressCountry": "ET"}},
        "occupationalCategory": j["category"], "url": j.get("apply_url"),
        "jobBenefits": "; ".join(j["supports_labels"]),
    }


def match_category(word: str) -> str | None:
    w = word.lower().replace("_", "-")
    for c in CATEGORIES:
        if w == c or w == c.replace("-", "") or c.startswith(w) or w in c.split("-"):
            return c
    return None


def match_city(words: str) -> str | None:
    w = words.lower().replace(" ", "")
    for c in CITIES:
        if c.lower().replace(" ", "").startswith(w) and len(w) >= 3:
            return c
    return None


# ───────── Alerts ─────────
def create_pending_alert(channel: str, category: str, city: str, supports: list[str], lang: str,
                         address: str | None = None) -> str:
    code = f"{secrets.randbelow(10**6):06d}" if channel == "sms" else "a" + secrets.token_hex(6)
    with db.tx() as c:
        c.execute("DELETE FROM alert_confirmations WHERE created_at < datetime('now','-1 day')")
        c.execute("INSERT INTO alert_confirmations (code, channel, address, category, city, supports_needed, lang) "
                  "VALUES (?,?,?,?,?,?,?)",
                  (code, channel, address, category or "any", city or "any",
                   json.dumps([s for s in supports if s in SUPPORT_LABELS]), lang))
    return code


def confirm_alert(code: str, address: str | None = None, channel: str | None = None) -> dict | None:
    """Turns a pending opt-in into a verified contact and an active subscription."""
    with db.tx() as c:
        row = c.execute("SELECT * FROM alert_confirmations WHERE code = ?", (code.strip(),)).fetchone()
        if not row or (channel and row["channel"] != channel):
            return None
        addr = row["address"] or address
        if not addr or (row["address"] and address and row["address"] != address):
            return None
        c.execute("""INSERT INTO contacts (channel, address, verified_at, consent_at) VALUES (?,?,datetime('now'),datetime('now'))
                     ON CONFLICT(channel, address) DO UPDATE SET verified_at=datetime('now'), opted_out_at=NULL,
                     consent_at=datetime('now')""", (row["channel"], addr))
        contact_id = c.execute("SELECT id FROM contacts WHERE channel=? AND address=?", (row["channel"], addr)).fetchone()[0]
        cur = c.execute("INSERT INTO alert_subscriptions (contact_id, category, city, supports_needed, lang) VALUES (?,?,?,?,?)",
                        (contact_id, row["category"], row["city"], row["supports_needed"], row["lang"]))
        c.execute("INSERT INTO consent_log (purpose, granted) VALUES ('alert_subscription', 1)")
        c.execute("DELETE FROM alert_confirmations WHERE code = ?", (row["code"],))
        return {"subscription_id": cur.lastrowid, "channel": row["channel"], "category": row["category"],
                "city": row["city"], "supports_needed": json.loads(row["supports_needed"])}


def stop_alerts(channel: str, address: str) -> int:
    with db.tx() as c:
        contact = c.execute("SELECT id FROM contacts WHERE channel=? AND address=?", (channel, address)).fetchone()
        if not contact:
            return 0
        n = c.execute("UPDATE alert_subscriptions SET active = 0 WHERE contact_id = ? AND active = 1",
                      (contact["id"],)).rowcount
        c.execute("UPDATE contacts SET opted_out_at = datetime('now') WHERE id = ?", (contact["id"],))
        c.execute("INSERT INTO consent_log (purpose, granted) VALUES ('alert_subscription', 0)")
        return n


def list_alerts(channel: str, address: str) -> list[dict]:
    with db.tx() as c:
        rows = c.execute("""SELECT s.* FROM alert_subscriptions s JOIN contacts c ON c.id = s.contact_id
                            WHERE c.channel=? AND c.address=? AND s.active=1""", (channel, address)).fetchall()
    return [{"id": r["id"], "category": r["category"], "city": r["city"],
             "supports_needed": db.jl(r["supports_needed"])} for r in rows]


def alert_text(job: dict, channel: str) -> str:
    stop = "Reply STOP to end alerts." if channel == "sms" else "Send /stop to end alerts."
    if channel == "sms":
        return f"New job: {job['title']}, {job['city']}. Deadline {job.get('deadline') or '-'}. {stop}"[:300]
    return (f"New job: {job['title']}\n{job['employer']}, {job['city']}\n{job['summary_simple']}\n"
            f"Deadline: {job.get('deadline') or 'none'}\nApply: {job.get('apply_url') or settings.public_base_url + '/site/jobs.html'}\n"
            f"(Sample job for the demo.)\n{stop}")


async def run_alerts() -> int:
    """Match new jobs to active, verified subscriptions. (subscription, job) is unique, so no repeats."""
    from .sms.gateway import get_gateway
    with db.tx() as c:
        rows = c.execute("""
            SELECT s.id AS sub_id, s.supports_needed, c.channel, c.address, j.*
            FROM alert_subscriptions s
            JOIN contacts c ON c.id = s.contact_id AND c.opted_out_at IS NULL AND c.verified_at IS NOT NULL
            JOIN jobs j ON j.active = 1
             AND (s.category = 'any' OR s.category = j.category)
             AND (s.city = 'any' OR s.city = j.city)
            LEFT JOIN alert_deliveries d ON d.subscription_id = s.id AND d.job_id = j.id
            WHERE s.active = 1 AND d.id IS NULL AND j.posted_at > s.created_at""").fetchall()
    sent = 0
    for r in rows:
        if not set(db.jl(r["supports_needed"])) <= set(db.jl(r["supports"])):
            continue
        with db.tx() as c:
            try:
                c.execute("INSERT INTO alert_deliveries (subscription_id, job_id, channel, status) VALUES (?,?,?,'queued')",
                          (r["sub_id"], r["id"], r["channel"]))
            except Exception:  # noqa: BLE001 - unique constraint: someone else already sent it
                continue
        job = job_dict(r)
        ok, err = False, None
        if r["channel"] == "sms":
            res = await get_gateway().send(r["address"], alert_text(job, "sms"))
            ok, err = res.ok, res.error
        elif send_telegram:
            ok = await send_telegram(r["address"], alert_text(job, "telegram"))
            err = None if ok else "telegram send failed"
        else:
            err = "telegram bot not running"
        with db.tx() as c:
            c.execute("UPDATE alert_deliveries SET status=?, error=?, sent_at=datetime('now') WHERE subscription_id=? AND job_id=?",
                      ("sent" if ok else "failed", err, r["sub_id"], r["id"]))
        sent += int(ok)
    return sent


# ───────── Handoffs ─────────
def queue_position(handoff_id: str) -> int:
    with db.tx() as c:
        row = c.execute("SELECT created_at, status FROM handoff_requests WHERE id = ?", (handoff_id,)).fetchone()
        if not row or row["status"] != "open":
            return 0
        return c.execute("SELECT COUNT(*) FROM handoff_requests WHERE status='open' AND created_at <= ?",
                         (row["created_at"],)).fetchone()[0]


def place_text(place: dict) -> str:
    msgs = place.get("recent_messages") or []
    return "\n".join([
        f"Page: {place.get('page_title') or 'unknown'}",
        f"Section: {place.get('section') or 'unknown'}",
        f"Focused: {place.get('focused') or 'nothing'}",
        f"Last error: {place.get('last_error') or 'none'}",
        "Last 3 messages: " + (" | ".join(str(m)[:140] for m in msgs[-3:]) if msgs else "none"),
    ])


async def create_handoff(session_id: str, contact_pref: str, place: dict, callback_phone: str | None) -> dict:
    hid = new_id(9)
    with db.tx() as c:
        c.execute("INSERT INTO handoff_requests (id, session_id, contact_pref, callback_phone, place_json) VALUES (?,?,?,?,?)",
                  (hid, session_id, contact_pref, callback_phone, json.dumps(place, ensure_ascii=False)))
        c.execute("INSERT INTO consent_log (session_id, purpose, granted) VALUES (?, 'place_message', 1)", (session_id,))
        if callback_phone:
            c.execute("INSERT INTO consent_log (session_id, purpose, granted) VALUES (?, 'callback_phone', 1)", (session_id,))
        c.execute("INSERT INTO handoff_messages (handoff_id, sender, text) VALUES (?, 'system', ?)",
                  (hid, "Request sent. A person will join soon."))
    if notify_staff:
        try:
            await notify_staff(f"New help request ({contact_pref.replace('_', ' ')})\n{place_text(place)}", hid)
        except Exception as e:  # noqa: BLE001
            log.warning("staff telegram notify failed: %s", e)
    return {"id": hid, "status": "open", "position": queue_position(hid)}


async def add_handoff_message(handoff_id: str, sender: str, text: str) -> dict:
    text = (text or "").strip()[:2000]
    with db.tx() as c:
        cur = c.execute("INSERT INTO handoff_messages (handoff_id, sender, text) VALUES (?,?,?)", (handoff_id, sender, text))
        row = c.execute("SELECT * FROM handoff_messages WHERE id = ?", (cur.lastrowid,)).fetchone()
    msg = dict(row)
    await hub.send(handoff_id, {"type": "message", "message": msg})
    return msg


async def set_handoff_status(handoff_id: str, status: str, staff_id: int | None = None, note: str | None = None) -> None:
    with db.tx() as c:
        if status == "claimed":
            c.execute("UPDATE handoff_requests SET status='claimed', claimed_by=?, claimed_at=datetime('now') WHERE id=?",
                      (staff_id, handoff_id))
        elif status in ("resolved", "abandoned"):
            # The call-back number is deleted when the request ends.
            c.execute("UPDATE handoff_requests SET status=?, resolved_at=datetime('now'), callback_phone=NULL, staff_note=? "
                      "WHERE id=?", (status, (note or "")[:140] or None, handoff_id))
    hub.clear(handoff_id)
    await hub.send(handoff_id, {"type": "status", "status": status})


# ───────── Retention ─────────
def purge() -> dict:
    with db.tx() as c:
        out = {
            "sessions": c.execute("DELETE FROM sessions WHERE expires_at < datetime('now')").rowcount,
            "handoff_messages": c.execute("""DELETE FROM handoff_messages WHERE handoff_id IN (
                SELECT id FROM handoff_requests WHERE resolved_at < datetime('now','-30 day'))""").rowcount,
            "question_log": c.execute("DELETE FROM question_log WHERE day < date('now','-90 day')").rowcount,
            "share_events": c.execute("DELETE FROM share_events WHERE created_at < datetime('now','-90 day')").rowcount,
            "consent_log": c.execute("DELETE FROM consent_log WHERE created_at < datetime('now','-90 day')").rowcount,
            "stale_subscriptions": c.execute("""DELETE FROM contacts WHERE opted_out_at < datetime('now','-30 day')
                OR (consent_at < datetime('now','-365 day') AND id NOT IN (
                    SELECT s.contact_id FROM alert_subscriptions s JOIN alert_deliveries d ON d.subscription_id = s.id
                    WHERE d.sent_at > datetime('now','-365 day')))""").rowcount,
        }
        c.execute("UPDATE handoff_requests SET callback_phone = NULL WHERE status IN ('resolved','abandoned')")
        # Abandon requests nobody claimed within 10 minutes of the learner leaving (no activity for 10 min).
        out["abandoned"] = c.execute("""UPDATE handoff_requests SET status='abandoned', resolved_at=datetime('now'),
            callback_phone=NULL WHERE status='open' AND contact_pref='chat' AND created_at < datetime('now','-10 minutes')
            AND session_id IN (SELECT id FROM sessions WHERE last_seen_at < datetime('now','-10 minutes'))""").rowcount
    return out

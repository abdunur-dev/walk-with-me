"""SQLite access. One short-lived connection per unit of work; schema applied at start-up."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from .config import settings

SCHEMA = Path(__file__).with_name("schema.sql")


def connect() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with tx() as c:
        c.executescript(SCHEMA.read_text(encoding="utf-8"))
        c.execute("PRAGMA journal_mode = WAL")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def in_days(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def jl(value) -> list:
    """Decode a JSON array column."""
    if value is None:
        return []
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return []


def seed(data_dir: Path | None = None) -> dict:
    """Load course.json, faq.json and jobs.json. Safe to run again (upserts)."""
    data_dir = data_dir or settings.data_dir
    course = json.loads((data_dir / "course.json").read_text(encoding="utf-8"))
    faq = json.loads((data_dir / "faq.json").read_text(encoding="utf-8"))
    jobs = json.loads((data_dir / "jobs.json").read_text(encoding="utf-8"))
    with tx() as c:
        for s in course["sections"]:
            c.execute(
                """INSERT INTO course_sections (id, course_id, concept_id, page_url, anchor, position, title_en, body_en,
                       title_am, body_am, keywords_en, keywords_am, term_pairs, verified_am)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET page_url=excluded.page_url, anchor=excluded.anchor,
                       position=excluded.position, title_en=excluded.title_en, body_en=excluded.body_en,
                       title_am=excluded.title_am, body_am=excluded.body_am, keywords_en=excluded.keywords_en,
                       keywords_am=excluded.keywords_am, term_pairs=excluded.term_pairs, verified_am=excluded.verified_am""",
                (s["id"], course["course_id"], course["concept_id"], course["page_url"], s["anchor"], s["position"],
                 s["title_en"], s["body_en"], s.get("title_am"), s.get("body_am"),
                 json.dumps(s.get("keywords_en", [])), json.dumps(s.get("keywords_am", []), ensure_ascii=False),
                 json.dumps(s.get("term_pairs", []), ensure_ascii=False), int(s.get("verified_am", 0))),
            )
        for f in faq:
            c.execute(
                """INSERT INTO faq_entries (id, section_id, question_en, question_am, answer_en, answer_am,
                       keywords_en, keywords_am, action_id)
                   VALUES (?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET section_id=excluded.section_id, question_en=excluded.question_en,
                       question_am=excluded.question_am, answer_en=excluded.answer_en, answer_am=excluded.answer_am,
                       keywords_en=excluded.keywords_en, keywords_am=excluded.keywords_am, action_id=excluded.action_id""",
                (f["id"], f.get("section_id"), f["question_en"], f.get("question_am"), f["answer_en"], f.get("answer_am"),
                 json.dumps(f.get("keywords_en", [])), json.dumps(f.get("keywords_am", []), ensure_ascii=False),
                 f.get("action_id")),
            )
        for j in jobs:
            posted = (datetime.now(timezone.utc) - timedelta(days=j.get("posted_days_ago", 0))).strftime("%Y-%m-%d %H:%M:%S")
            c.execute(
                """INSERT INTO jobs (id, title, employer, category, city, summary_simple, description, apply_url,
                       contact_hint, deadline, posted_at, supports, active)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
                   ON CONFLICT(id) DO UPDATE SET title=excluded.title, employer=excluded.employer,
                       category=excluded.category, city=excluded.city, summary_simple=excluded.summary_simple,
                       description=excluded.description, apply_url=excluded.apply_url,
                       contact_hint=excluded.contact_hint, deadline=excluded.deadline, supports=excluded.supports""",
                (j["id"], j["title"], j["employer"], j["category"], j["city"], j["summary_simple"], j["description"],
                 j.get("apply_url"), j.get("contact_hint"), j.get("deadline"), posted, json.dumps(j.get("supports", []))),
            )
    return {"sections": len(course["sections"]), "faq": len(faq), "jobs": len(jobs)}

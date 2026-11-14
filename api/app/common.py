"""Shared helpers: one error shape, staff auth, rate limits, phone numbers, WebSocket hub."""
from __future__ import annotations

import asyncio
import os
import hashlib
import hmac
import re
import secrets
import time
from collections import defaultdict, deque

from fastapi import Header, WebSocket
from fastapi.responses import JSONResponse

from . import db
from .config import settings


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fix: str = ""):
        self.status, self.code, self.message, self.fix = status, code, message, fix


def error_response(status: int, code: str, message: str, fix: str = "") -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "fix": fix}})


# ───────── Staff auth ─────────
def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def ensure_env_staff() -> None:
    """The STAFF_TOKEN from the environment becomes a staff user (stored hashed)."""
    if not settings.staff_token:
        return
    with db.tx() as c:
        c.execute("INSERT OR IGNORE INTO staff_users (display_name, token_hash, role) VALUES (?,?,?)",
                  ("Staff", _hash(settings.staff_token), "admin"))


def staff_from_token(token: str | None) -> dict | None:
    if not token:
        return None
    with db.tx() as c:
        row = c.execute("SELECT id, display_name, role FROM staff_users WHERE token_hash = ?", (_hash(token),)).fetchone()
    return dict(row) if row else None


def require_staff(authorization: str | None = Header(default=None)) -> dict:
    token = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None
    staff = staff_from_token(token)
    if not staff:
        raise ApiError(401, "staff_token_required", "This page needs the staff token.",
                       "Enter the staff token you were given. Ask the organiser if you do not have one.")
    return staff


# ───────── Rate limits (in memory, per key) ─────────
class RateLimiter:
    def __init__(self, limit: int, window_s: float):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            wait = int(self.window - (now - q[0])) + 1
            raise ApiError(429, "rate_limited", f"Too many messages. Wait {wait} seconds.", f"Try again in {wait} seconds.")
        q.append(now)


chat_limit = RateLimiter(int(os.getenv("CHAT_RATE_LIMIT", "20")), 60)
handoff_limit = RateLimiter(5, 600)
sms_limit = RateLimiter(10, 300)
subscribe_limit = RateLimiter(5, 600)


# ───────── Phone numbers (Ethiopia) ─────────
_PHONE = re.compile(r"^(?:\+251|251|0)([79]\d{8})$")


def to_e164(raw: str) -> str | None:
    """Accepts +2519XXXXXXXX, 09XXXXXXXX, +2517XXXXXXXX, 07XXXXXXXX (spaces and dashes ignored)."""
    digits = re.sub(r"[\s\-()]", "", raw or "")
    m = _PHONE.match(digits)
    return f"+251{m.group(1)}" if m else None


PHONE_FIX = "Use a number like 0911 234567, 0711 234567 or +251 911 234567."


def phone_hash(e164: str) -> str:
    return hmac.new(settings.hmac_secret.encode(), e164.encode(), hashlib.sha256).hexdigest()


def new_id(n: int = 16) -> str:
    return secrets.token_urlsafe(n)


# ───────── WebSocket hub for handoffs ─────────
class Hub:
    """Learner and staff sockets per handoff, plus page snapshots held in memory only."""

    def __init__(self) -> None:
        self.rooms: dict[str, set[tuple[WebSocket, str]]] = defaultdict(set)
        self.snapshots: dict[str, dict] = {}
        self.lock = asyncio.Lock()

    async def join(self, handoff_id: str, ws: WebSocket, who: str) -> None:
        async with self.lock:
            self.rooms[handoff_id].add((ws, who))

    async def leave(self, handoff_id: str, ws: WebSocket, who: str) -> None:
        async with self.lock:
            self.rooms[handoff_id].discard((ws, who))

    async def send(self, handoff_id: str, event: dict, to: str | None = None) -> None:
        for ws, who in list(self.rooms.get(handoff_id, ())):
            if to and who != to:
                continue
            try:
                await ws.send_json(event)
            except Exception:  # noqa: BLE001
                await self.leave(handoff_id, ws, who)

    def clear(self, handoff_id: str) -> None:
        self.snapshots.pop(handoff_id, None)


hub = Hub()

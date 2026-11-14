"""Default gateway: sends nothing. Keeps the last messages in memory for site/sms-sim.html."""
from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone

from .gateway import DeliveryResult

log = logging.getLogger("wwm.sms")
OUTBOX: deque = deque(maxlen=200)


class MockGateway:
    name = "mock"

    async def send(self, to: str, text: str) -> DeliveryResult:
        OUTBOX.append({"to": to, "text": text, "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                       "segments": segments(text)})
        log.info("[mock sms] to=%s text=%r", to[:-4] + "****", text)
        return DeliveryResult(ok=True, provider=self.name)


def segments(text: str) -> int:
    """GSM-7 fits 160 characters per SMS; Amharic needs UCS-2 at 70."""
    ucs2 = any(ord(ch) > 0x7F for ch in text)
    per = (67 if len(text) > 70 else 70) if ucs2 else (153 if len(text) > 160 else 160)
    return max(1, -(-len(text) // per))

"""Background loops: job alerts every ALERT_INTERVAL_MINUTES (default 15), purge every hour."""
from __future__ import annotations

import asyncio
import logging

from .. import services
from ..config import settings

log = logging.getLogger("wwm.scheduler")


async def _loop(every_s: float, fn, name: str) -> None:
    while True:
        try:
            out = fn()
            if asyncio.iscoroutine(out):
                out = await out
            log.info("%s: %s", name, out)
        except Exception as e:  # noqa: BLE001
            log.exception("%s failed: %s", name, e)
        await asyncio.sleep(every_s)


def start() -> list[asyncio.Task]:
    return [
        asyncio.create_task(_loop(settings.scheduler_minutes * 60, services.run_alerts, "alerts")),
        asyncio.create_task(_loop(3600, services.purge, "purge")),
    ]

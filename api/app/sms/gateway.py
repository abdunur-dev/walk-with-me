"""SMS gateway interface. Swapping the provider is one file: add a class and a branch in get_gateway()."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..config import settings


@dataclass
class DeliveryResult:
    ok: bool
    provider: str
    error: str | None = None


class SmsGateway(Protocol):
    name: str

    async def send(self, to: str, text: str) -> DeliveryResult: ...


_gateway: SmsGateway | None = None


def get_gateway() -> SmsGateway:
    global _gateway
    if _gateway is None:
        if settings.sms_gateway == "africastalking":
            from .africastalking import AfricasTalkingGateway
            _gateway = AfricasTalkingGateway()
        else:
            from .mock import MockGateway
            _gateway = MockGateway()
    return _gateway

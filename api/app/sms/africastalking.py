"""Africa's Talking gateway (REST). VERIFY with a mentor that it delivers to Ethio Telecom and
Safaricom Ethiopia numbers and what a sender id costs before relying on it."""
from __future__ import annotations

import httpx

from ..config import settings
from .gateway import DeliveryResult

URL = "https://api.africastalking.com/version1/messaging"


class AfricasTalkingGateway:
    name = "africastalking"

    async def send(self, to: str, text: str) -> DeliveryResult:
        if not settings.africastalking_username or not settings.africastalking_api_key:
            return DeliveryResult(ok=False, provider=self.name, error="AFRICASTALKING_USERNAME/API_KEY not set")
        data = {"username": settings.africastalking_username, "to": to, "message": text}
        if settings.africastalking_sender_id:
            data["from"] = settings.africastalking_sender_id
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(URL, data=data, headers={"apiKey": settings.africastalking_api_key,
                                                                "Accept": "application/json"})
            if r.status_code >= 300:
                return DeliveryResult(ok=False, provider=self.name, error=f"HTTP {r.status_code}")
            return DeliveryResult(ok=True, provider=self.name)
        except httpx.HTTPError as e:
            return DeliveryResult(ok=False, provider=self.name, error=str(e))

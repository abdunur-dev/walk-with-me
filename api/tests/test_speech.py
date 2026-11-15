import asyncio
from pathlib import Path

import anyio
import httpx
import pytest

from app import speech_translation
from app.common import ApiError
from app.config import settings
from app.main import app
from app.routers import speech


def _post_speech(**kwargs):
    async def send():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/v1/speech/translate", **kwargs)

    return anyio.run(send)


def test_speech_route_is_disabled_by_default(monkeypatch):
    monkeypatch.setattr(settings, "speech_translation_enabled", False)
    response = _post_speech(
        files={"audio": ("sample.wav", b"audio", "audio/wav")},
        data={"consent": "true"},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "speech_translation_disabled"


def test_speech_upload_is_transient_and_returns_translation(monkeypatch):
    monkeypatch.setattr(settings, "speech_translation_enabled", True)

    async def allow_rate(client_key):
        return None

    monkeypatch.setattr(speech, "_check_rate_limit", allow_rate)
    seen: dict[str, str] = {}

    def fake_pipeline(path, target_language):
        seen["path"] = str(path)
        seen["bytes"] = Path(path).read_bytes().decode()
        return {
            "transcript": "ሰላም",
            "source_language": "Amharic",
            "translation": "Hello",
            "target_language": target_language,
        }

    monkeypatch.setattr(speech_translation, "speech_to_translated_text", fake_pipeline)

    async def run_inline(fn, *args):
        return fn(*args)

    monkeypatch.setattr(speech, "run_in_threadpool", run_inline)
    response = _post_speech(
        files={"audio": ("sample.wav", b"short sample", "audio/wav")},
        data={"consent": "true"},
    )

    assert response.status_code == 200
    assert response.json()["translation"] == "Hello"
    assert seen["bytes"] == "short sample"
    assert not Path(seen["path"]).exists()


def test_speech_requires_consent(monkeypatch):
    monkeypatch.setattr(settings, "speech_translation_enabled", True)
    response = _post_speech(
        files={"audio": ("sample.wav", b"audio", "audio/wav")},
        data={"consent": "false"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "consent_required"


def test_production_rate_limit_fails_closed_without_redis(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "speech_rate_limit_redis_url", "")
    with pytest.raises(ApiError) as error:
        asyncio.run(speech._check_rate_limit("127.0.0.1"))
    assert error.value.code == "speech_rate_limit_unavailable"

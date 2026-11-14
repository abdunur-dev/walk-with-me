"""Short, consent-based Amharic audio translation endpoint."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import tempfile
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from ..common import ApiError, speech_limit
from ..config import settings

router = APIRouter(prefix="/v1/speech", tags=["speech translation"])
log = logging.getLogger("wwm.speech")
_inference_slot = asyncio.Semaphore(1)
_ALLOWED_SUFFIXES = {".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".flac", ".webm"}
_CHUNK_BYTES = 1024 * 1024
_RATE_LIMIT = 4
_RATE_WINDOW_SECONDS = 900
_redis = None


async def _check_rate_limit(client_key: str) -> None:
    """Use Redis across production replicas; use the existing in-memory limiter locally."""
    global _redis
    if not settings.speech_rate_limit_redis_url:
        if settings.app_env == "production":
            raise ApiError(503, "speech_rate_limit_unavailable", "Audio translation is temporarily unavailable.",
                           "The site team must configure the shared rate-limit service.")
        speech_limit.check(client_key)
        return

    try:
        from redis.asyncio import Redis

        if _redis is None:
            _redis = Redis.from_url(settings.speech_rate_limit_redis_url, decode_responses=True)
        window = int(time.time() // _RATE_WINDOW_SECONDS)
        client_hash = hashlib.sha256(client_key.encode()).hexdigest()
        key = f"wwm:speech:{window}:{client_hash}"
        count = await _redis.eval(
            "local n=redis.call('INCR',KEYS[1]); "
            "if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
            1,
            key,
            _RATE_WINDOW_SECONDS,
        )
    except Exception as exc:
        log.exception("shared speech rate limiter unavailable")
        raise ApiError(503, "speech_rate_limit_unavailable", "Audio translation is temporarily unavailable.",
                       "Try again later or contact the site team.") from exc

    if count > _RATE_LIMIT:
        retry_after = _RATE_WINDOW_SECONDS - int(time.time()) % _RATE_WINDOW_SECONDS
        raise ApiError(429, "rate_limited", "Too many audio requests. Wait before trying again.",
                       f"Try again in about {retry_after} seconds.")


async def close_speech_rate_limiter() -> None:
    if _redis is not None:
        await _redis.aclose()


@router.post("/translate", summary="Transcribe Amharic audio and translate it to English")
async def translate_audio(
    request: Request,
    audio: UploadFile = File(..., description="Amharic audio, up to 15 MB and 2 minutes"),
    consent: bool = Form(..., description="Confirm the audio may be processed for this translation"),
    target_language: Literal["English"] = Form(default="English"),
):
    if not settings.speech_translation_enabled:
        raise ApiError(
            503,
            "speech_translation_disabled",
            "Audio translation is not enabled on this server.",
            "Ask the site team to configure the speech model service.",
        )
    if not consent:
        raise ApiError(400, "consent_required", "Consent is needed before audio can be processed.",
                       "Select the audio-processing consent box and try again.")
    client_key = request.client.host if request.client else "anonymous"
    await _check_rate_limit(client_key)

    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise ApiError(415, "unsupported_audio", "Choose a WAV, MP3, M4A, OGG, FLAC or WebM audio file.",
                       "Export the recording to one of the supported audio formats and try again.")

    max_bytes = max(1, settings.speech_max_upload_mb) * 1024 * 1024
    total_bytes = 0
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="wwm-upload-", suffix=suffix, delete=False) as target:
            temp_path = target.name
            while chunk := await audio.read(_CHUNK_BYTES):
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise ApiError(413, "audio_too_large", f"Audio must be {settings.speech_max_upload_mb} MB or smaller.",
                                   "Trim the recording or choose a smaller audio file.")
                target.write(chunk)
        if total_bytes == 0:
            raise ApiError(400, "empty_audio", "The selected audio file is empty.", "Choose a recording with speech and try again.")

        try:
            acquired = await asyncio.wait_for(_inference_slot.acquire(), timeout=10)
        except TimeoutError as exc:
            raise ApiError(503, "speech_busy", "Audio translation is busy right now.",
                           "Wait a moment and try again.") from exc
        try:
            from ..speech_translation import speech_to_translated_text

            return await run_in_threadpool(speech_to_translated_text, temp_path, target_language)
        except (ValueError, FileNotFoundError) as exc:
            raise ApiError(422, "invalid_audio", str(exc), "Choose a readable audio file no longer than two minutes.") from exc
        except Exception as exc:
            log.exception("speech translation failed")
            raise ApiError(503, "speech_backend_unavailable", "Audio translation could not be completed.",
                           "Try again later or contact the site team if this continues.") from exc
        finally:
            _inference_slot.release()
    finally:
        await audio.close()
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)

"""All settings come from environment variables (see .env.example). Nothing secret is hard-coded."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(os.getenv("WWM_ROOT", Path(__file__).resolve().parents[2]))


def _load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


def _f(name: str, default: str) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return float(default)


@dataclass
class Settings:
    ai_provider: str = field(default_factory=lambda: os.getenv("AI_PROVIDER", "offline").lower())
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", ""))
    local_llm_url: str = field(default_factory=lambda: os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1"))
    local_llm_model: str = field(default_factory=lambda: os.getenv("LOCAL_LLM_MODEL", ""))
    provider_timeout: float = field(default_factory=lambda: _f("PROVIDER_TIMEOUT", "6"))
    min_score: float = field(default_factory=lambda: _f("MIN_SCORE", "0.35"))
    k_min: int = field(default_factory=lambda: int(os.getenv("K_MIN", "3")))
    telegram_bot_token: str = field(default_factory=lambda: os.getenv("TELEGRAM_BOT_TOKEN", ""))
    telegram_bot_username: str = field(default_factory=lambda: os.getenv("TELEGRAM_BOT_USERNAME", ""))
    telegram_staff_chat_id: str = field(default_factory=lambda: os.getenv("TELEGRAM_STAFF_CHAT_ID", ""))
    telegram_mode: str = field(default_factory=lambda: os.getenv("TELEGRAM_MODE", "polling"))
    sms_gateway: str = field(default_factory=lambda: os.getenv("SMS_GATEWAY", "mock"))
    africastalking_username: str = field(default_factory=lambda: os.getenv("AFRICASTALKING_USERNAME", ""))
    africastalking_api_key: str = field(default_factory=lambda: os.getenv("AFRICASTALKING_API_KEY", ""))
    africastalking_sender_id: str = field(default_factory=lambda: os.getenv("AFRICASTALKING_SENDER_ID", ""))
    staff_token: str = field(default_factory=lambda: os.getenv("STAFF_TOKEN", ""))
    hmac_secret: str = field(default_factory=lambda: os.getenv("HMAC_SECRET", "change-me"))
    public_base_url: str = field(default_factory=lambda: os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/"))
    db_path: Path = field(default_factory=lambda: Path(os.getenv("DB_PATH", str(ROOT / "var" / "walkwithme.db"))))
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", str(ROOT / "data"))))
    scheduler_minutes: float = field(default_factory=lambda: _f("ALERT_INTERVAL_MINUTES", "15"))
    run_background: bool = field(default_factory=lambda: os.getenv("RUN_BACKGROUND", "1") == "1")


settings = Settings()

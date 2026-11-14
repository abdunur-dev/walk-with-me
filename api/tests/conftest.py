import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_tmp = tempfile.mkdtemp(prefix="wwm-test-")
os.environ.update({
    "WWM_ROOT": str(ROOT), "DB_PATH": str(Path(_tmp) / "test.db"), "RUN_BACKGROUND": "0",
    "AI_PROVIDER": "offline", "STAFF_TOKEN": "test-staff-token", "K_MIN": "2", "SMS_GATEWAY": "mock",
    "TELEGRAM_BOT_TOKEN": "", "CHAT_RATE_LIMIT": "10000",
})
sys.path.insert(0, str(ROOT / "api"))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def staff():
    return {"Authorization": "Bearer test-staff-token"}


@pytest.fixture
def session_id(client):
    return client.post("/v1/sessions", json={"channel": "web", "lang": "en"}).json()["session_id"]

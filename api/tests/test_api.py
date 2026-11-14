import asyncio

from app import db, services


def test_health_and_openapi(client):
    assert client.get("/healthz").json() == {"ok": True}
    spec = client.get("/openapi.json").json()
    assert "/v1/chat" in spec["paths"] and "/v1/jobs" in spec["paths"]


def test_error_shape(client):
    r = client.post("/v1/chat", json={"text": ""})
    assert r.status_code == 422 and set(r.json()["error"]) == {"code", "message", "fix"}


def test_staff_needs_token_and_has_no_cors(client):
    r = client.get("/v1/staff/handoffs", headers={"Origin": "https://evil.example"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "staff_token_required"
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_public_cors(client):
    r = client.get("/v1/course/sections", headers={"Origin": "null"})
    assert r.headers["access-control-allow-origin"] == "*"


def test_handoff_flow(client, staff, session_id):
    place = {"page_title": "The future of the VA industry", "section": "Key points",
             "focused": "button: Mark as complete", "recent_messages": ["a", "b", "c"]}
    h = client.post("/v1/handoff", json={"session_id": session_id, "contact_pref": "chat", "place": place}).json()
    assert h["status"] == "open" and h["position"] >= 1
    q = client.get("/v1/staff/handoffs", headers=staff).json()["items"]
    assert any(i["id"] == h["id"] for i in q)
    assert client.post(f"/v1/staff/handoffs/{h['id']}/claim", headers=staff).json()["ok"]
    client.post(f"/v1/staff/handoffs/{h['id']}/messages", headers=staff, json={"text": "Hi, I can help"})
    client.post(f"/v1/handoff/{h['id']}/messages", json={"session_id": session_id, "text": "Thanks"})
    r = client.get(f"/v1/handoff/{h['id']}", params={"session_id": session_id}).json()
    assert r["status"] == "claimed" and [m["sender"] for m in r["messages"]][-2:] == ["staff", "learner"]
    assert client.get(f"/v1/handoff/{h['id']}", params={"session_id": "other"}).status_code == 403


def test_websocket_chat(client, staff, session_id):
    h = client.post("/v1/handoff", json={"session_id": session_id, "place": {}}).json()
    with client.websocket_connect(f"/v1/handoff/{h['id']}/ws?session_id={session_id}") as ws:
        client.post(f"/v1/staff/handoffs/{h['id']}/messages", headers=staff, json={"text": "hello from staff"})
        ev = ws.receive_json()
        assert ev["type"] == "message" and ev["message"]["text"] == "hello from staff"


def test_callback_phone_validated_and_deleted_on_resolve(client, staff, session_id):
    bad = client.post("/v1/handoff", json={"session_id": session_id, "contact_pref": "phone_callback",
                                           "place": {}, "callback_phone": "12345"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_phone"
    h = client.post("/v1/handoff", json={"session_id": session_id, "contact_pref": "phone_callback",
                                         "place": {}, "callback_phone": "0911 234 567"}).json()
    d = client.get(f"/v1/staff/handoffs/{h['id']}", headers=staff).json()
    assert d["callback_phone"] == "+251911234567"
    r = client.post(f"/v1/staff/handoffs/{h['id']}/resolve", headers=staff, json={"note": "call 0911234567"})
    assert r.status_code == 422
    client.post(f"/v1/staff/handoffs/{h['id']}/resolve", headers=staff, json={"note": "Explained the menu"})
    with db.tx() as c:
        assert c.execute("SELECT callback_phone FROM handoff_requests WHERE id=?", (h["id"],)).fetchone()[0] is None


def test_snapshot_is_sanitised(client, staff, session_id):
    h = client.post("/v1/handoff", json={"session_id": session_id, "place": {}}).json()
    html = '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:evil()">x</a>'
    client.post("/v1/share/snapshot", json={"session_id": session_id, "handoff_id": h["id"], "html": html})
    snap = client.get(f"/v1/staff/handoffs/{h['id']}", headers=staff).json()["snapshot"]["html"]
    assert "script" not in snap and "onclick" not in snap and "javascript:" not in snap


def test_jobs_filters_and_jsonld(client):
    all_jobs = client.get("/v1/jobs").json()
    assert all_jobs["count"] >= 20
    r = client.get("/v1/jobs", params={"supports": "sign_language_interpreter,remote_option"}).json()
    assert r["count"] >= 1
    assert all({"sign_language_interpreter", "remote_option"} <= set(j["supports"]) for j in r["items"])
    j = r["items"][0]
    assert j["deadline_ethiopian"]["label_en"] and j["sample"] is True
    ld = client.get("/v1/jobs", params={"format": "jsonld", "city": "Adama"}).json()
    assert ld and ld[0]["@type"] == "JobPosting"


def test_accommodation_draft_stores_nothing(client):
    tables = ("messages", "consent_log", "question_log")
    with db.tx() as c:
        before = sum(c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables)
    r = client.post("/v1/accommodation/draft", json={"job_id": "job-001", "adjustments": ["extra_time", "quiet_room"]}).json()
    assert "extra time" in r["text_en"] and r["stored"] is False and r["text_am"] is None
    with db.tx() as c:
        after = sum(c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables)
    assert before == after


def test_sms_alert_opt_in_and_unique_delivery(client):
    from app.sms.mock import OUTBOX
    r = client.post("/v1/alerts/subscribe", json={"channel": "sms", "phone": "0922000111",
                                                  "category": "driver", "city": "Adama"})
    assert r.json()["status"] == "pending"
    code = OUTBOX[-1]["text"].split("code is ")[1][:6]
    wrong = "000000" if code != "000000" else "111111"
    assert client.post("/v1/alerts/confirm", json={"phone": "+251922000111", "code": wrong}).status_code == 422
    assert client.post("/v1/alerts/confirm", json={"phone": "+251922000111", "code": code}).json()["status"] == "active"
    with db.tx() as c:
        c.execute("""INSERT INTO jobs (id, title, employer, category, city, summary_simple, description, posted_at, supports)
                     VALUES ('job-new', 'Van driver', 'Sample Co', 'driver', 'Adama', 'Drive a van.', 'x',
                     datetime('now','+1 minute'), '[]')""")
    assert asyncio.run(services.run_alerts()) == 1
    assert asyncio.run(services.run_alerts()) == 0          # never the same job twice
    assert "Reply STOP" in OUTBOX[-1]["text"]
    assert client.post("/v1/alerts/unsubscribe", json={"channel": "sms", "address": "0922000111"}).json()["stopped"] == 1


def test_sms_commands(client):
    def send(t):
        return client.post("/v1/sms/inbound", json={"from": "0933000222", "text": t}).json()["reply"]
    assert "HELP" in send("hello")
    assert "Sample" in send("JOBS driver adama")
    assert "YES" in send("ALERT driver adama")
    assert "Alerts on" in send("YES")
    assert send("STOP") == "Alerts stopped."
    assert "From:" in send("ASK what skills do employers ask for")
    assert "call you" in send("HELP")


def test_teacher_view_threshold_and_no_ids(client, staff):
    for _ in range(2):
        client.post("/v1/chat", json={"text": "what goes in a portfolio please", "lang": "en"})
    client.post("/v1/chat", json={"text": "a question asked only once about tools", "lang": "en"})
    items = client.get("/v1/teacher/top-questions", headers=staff).json()["items"]
    qs = [i["question"] for i in items]
    assert any("portfolio" in q for q in qs)
    assert not any("only once" in q for q in qs)
    assert all(set(i) == {"question", "section_id", "section_title", "count", "not_in_course"} for i in items)
    csv = client.get("/v1/teacher/top-questions", params={"format": "csv"}, headers=staff)
    assert csv.text.startswith("question,section,count")


def test_purge_and_delete_me(client, session_id):
    with db.tx() as c:
        c.execute("UPDATE sessions SET expires_at = datetime('now','-1 day') WHERE id = ?", (session_id,))
    assert services.purge()["sessions"] >= 1
    sid = client.post("/v1/sessions", json={}).json()["session_id"]
    assert client.delete("/v1/me", params={"session_id": sid}).json() == {"deleted": True}
    assert client.delete("/v1/me", params={"session_id": sid}).status_code == 404


def test_phone_formats():
    from app.common import to_e164
    assert to_e164("+251911234567") == to_e164("0911234567") == "+251911234567"
    assert to_e164("0711234567") == to_e164("+251 711 234 567") == "+251711234567"
    assert to_e164("0811234567") is None and to_e164("12345") is None

PRAGMA foreign_keys = ON;

-- ───────── Course content ─────────
CREATE TABLE IF NOT EXISTS course_sections (
  id            TEXT PRIMARY KEY,            -- e.g. "va-foundations.future-of-va.callouts"
  course_id     TEXT NOT NULL,               -- "VA-1"
  concept_id    TEXT NOT NULL,               -- "future-of-the-va-industry"
  page_url      TEXT NOT NULL,               -- "/savanna/pages/concept-with-navigation.html"
  anchor        TEXT NOT NULL,               -- element id to scroll to, e.g. "wwm-s3"
  position      INTEGER NOT NULL,            -- order inside the concept
  title_en      TEXT NOT NULL,
  body_en       TEXT NOT NULL,               -- plain text extracted from the page
  title_am      TEXT,                        -- written or verified by a native speaker
  body_am       TEXT,
  keywords_en   TEXT NOT NULL DEFAULT '[]',  -- JSON array
  keywords_am   TEXT NOT NULL DEFAULT '[]',  -- JSON array, already homophone-folded
  term_pairs    TEXT NOT NULL DEFAULT '[]',  -- JSON [{ "en": "...", "am": "..." }]
  verified_am   INTEGER NOT NULL DEFAULT 0   -- 1 once a native speaker has checked it
);
CREATE INDEX IF NOT EXISTS idx_sections_course ON course_sections(course_id, concept_id, position);

CREATE TABLE IF NOT EXISTS faq_entries (                    -- human-written, used by the offline provider
  id            TEXT PRIMARY KEY,
  section_id    TEXT REFERENCES course_sections(id) ON DELETE SET NULL,
  question_en   TEXT NOT NULL,
  question_am   TEXT,
  answer_en     TEXT NOT NULL,
  answer_am     TEXT,
  keywords_en   TEXT NOT NULL DEFAULT '[]',
  keywords_am   TEXT NOT NULL DEFAULT '[]',
  action_id     TEXT                          -- optional Show me action, e.g. "mark_complete"
);

-- ───────── Teacher view: no session link on purpose ─────────
CREATE TABLE IF NOT EXISTS question_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  day           TEXT NOT NULL,                -- "2026-11-15" (no time of day)
  lang          TEXT NOT NULL CHECK (lang IN ('en','am')),
  question_norm TEXT NOT NULL,                -- normalised text, personal details stripped
  section_id    TEXT REFERENCES course_sections(id) ON DELETE SET NULL,
  answered      INTEGER NOT NULL              -- 1 answered, 0 "not in the course"
);
CREATE INDEX IF NOT EXISTS idx_qlog_day ON question_log(day, section_id);

-- ───────── Conversations ─────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,             -- random 128-bit, created in the widget
  channel       TEXT NOT NULL CHECK (channel IN ('web','telegram','sms')),
  channel_ref   TEXT,                         -- telegram chat id or hashed phone (HMAC), null for web
  lang          TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','am')),
  mode          TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','simple')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL                  -- created_at + 7 days; purge job deletes after
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('learner','helper')),
  text          TEXT NOT NULL,
  lang          TEXT NOT NULL,
  citations     TEXT NOT NULL DEFAULT '[]',   -- JSON [{type:"section"|"job", id:"..."}]
  provider      TEXT,                          -- "claude" | "local" | "offline"
  answered_offline INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);

-- ───────── Human help ─────────
CREATE TABLE IF NOT EXISTS staff_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name  TEXT NOT NULL,                -- first name only
  token_hash    TEXT NOT NULL UNIQUE,         -- SHA-256 of the bearer token
  role          TEXT NOT NULL DEFAULT 'helper' CHECK (role IN ('helper','teacher','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS handoff_requests (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contact_pref  TEXT NOT NULL CHECK (contact_pref IN ('chat','voice_callback','phone_callback')),
  callback_phone TEXT,                         -- E.164, deleted when status becomes resolved/abandoned
  place_json    TEXT NOT NULL,                 -- the previewed place message the learner approved
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved','abandoned')),
  claimed_by    INTEGER REFERENCES staff_users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at    TEXT,
  resolved_at   TEXT,
  helpful       INTEGER,                       -- 1 yes, 0 no, null unanswered
  staff_note    TEXT                           -- one line, no personal data (validated)
);
CREATE INDEX IF NOT EXISTS idx_handoff_status ON handoff_requests(status, created_at);

CREATE TABLE IF NOT EXISTS handoff_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  handoff_id    TEXT NOT NULL REFERENCES handoff_requests(id) ON DELETE CASCADE,
  sender        TEXT NOT NULL CHECK (sender IN ('learner','staff','system')),
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_handoff_msgs ON handoff_messages(handoff_id, id);

CREATE TABLE IF NOT EXISTS share_events (                   -- consent trail only, never content
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  handoff_id    TEXT NOT NULL REFERENCES handoff_requests(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('snapshot','screen')),
  action        TEXT NOT NULL CHECK (action IN ('requested','accepted','declined','started','updated','stopped')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Jobs ─────────
CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  employer      TEXT NOT NULL,
  category      TEXT NOT NULL,                 -- "driver", "customer-support", "data-entry", ...
  city          TEXT NOT NULL,
  summary_simple TEXT NOT NULL,                -- plain-language version, 12-word sentences
  description   TEXT NOT NULL,
  apply_url     TEXT,
  contact_hint  TEXT,                          -- where an accommodation message can go (email, phone)
  deadline      TEXT,                          -- ISO date (Gregorian); Ethiopian date computed on read
  posted_at     TEXT NOT NULL DEFAULT (datetime('now')),
  supports      TEXT NOT NULL DEFAULT '[]',    -- JSON array of tags, see section 4
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_jobs_filter ON jobs(active, category, city, posted_at);

-- ───────── Alerts ─────────
CREATE TABLE IF NOT EXISTS contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel       TEXT NOT NULL CHECK (channel IN ('telegram','sms')),
  address       TEXT NOT NULL,                 -- telegram chat id, or E.164 phone
  verified_at   TEXT,
  consent_at    TEXT NOT NULL,
  opted_out_at  TEXT,
  UNIQUE (channel, address)
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,                 -- "any" allowed
  city          TEXT NOT NULL,                 -- "any" allowed
  supports_needed TEXT NOT NULL DEFAULT '[]',  -- JSON tags. Never labelled as a disability anywhere
  lang          TEXT NOT NULL DEFAULT 'en',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subs_active ON alert_subscriptions(active, category, city);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('queued','sent','failed')),
  error         TEXT,
  sent_at       TEXT,
  UNIQUE (subscription_id, job_id)             -- nobody gets the same job twice
);

-- ───────── Consent trail ─────────
CREATE TABLE IF NOT EXISTS consent_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT,                          -- may be null for SMS opt-ins
  purpose       TEXT NOT NULL CHECK (purpose IN ('place_message','page_snapshot','screen_share','alert_subscription','callback_phone')),
  granted       INTEGER NOT NULL,              -- 1 granted, 0 declined or withdrawn
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Addition (not in the schema doc): pending alert opt-ins ─────────
-- Nothing becomes a contact or a subscription until the learner confirms the code.
CREATE TABLE IF NOT EXISTS alert_confirmations (
  code          TEXT PRIMARY KEY,              -- 6 digits for SMS, longer token for the Telegram /start payload
  channel       TEXT NOT NULL CHECK (channel IN ('telegram','sms')),
  address       TEXT,                          -- E.164 for SMS; null for Telegram until /start
  category      TEXT NOT NULL,
  city          TEXT NOT NULL,
  supports_needed TEXT NOT NULL DEFAULT '[]',
  lang          TEXT NOT NULL DEFAULT 'en',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

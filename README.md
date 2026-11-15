# Walk With Me

A help widget for Savanna course pages. It answers in Amharic or English **from the course content only**, shows where each answer came from, moves the learner's focus to the control they are looking for, and brings in a person with one button. The same helper works on Telegram and by SMS, and covers jobs: alerts, job questions and interview accommodation requests.

Digital Bridge Accessibility Hackathon 2026 · Track 3.

## What is in this repository

| Folder | What |
|---|---|
| `api/` | FastAPI app: chat with retrieval and citations, AI providers, human help (REST + WebSocket), jobs, alerts, SMS, Telegram bot, teacher view |
| `widget/` | `walk-with-me.js` (no build step, Shadow DOM), `actions.js` (Show me targets), `faq-bundle.js` (offline answers) |
| `web/` | The website in Next.js (static export): home, install docs, jobs, staff console, teacher view, SMS simulator, 404/500 |
| `site/` | Older plain-HTML version of the site, used only if `web/out` has not been built |
| `savanna/` | **Stand-in** Savanna pages used for the demo. Replace with the real starter (see below) |
| `data/` | `course.json` (generated), `faq.json` (human-written), `jobs.json` (20 sample jobs) |
| `scripts/` | `extract_course.py`, `build_faq_bundle.py`, `seed.py` |
| `docs/` | Conformance report (to fill), testing notes, `openapi.json` |

## Install in one hour

### With Docker

```sh
cp .env.example .env          # set STAFF_TOKEN to a long random value
docker compose up --build
```

Open http://localhost:8000. Nothing else is needed: `AI_PROVIDER=offline` answers from the human-written FAQ and course text.

### Without Docker (Python 3.11+, Node 20+)

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt        # Windows: .venv\Scripts\pip
cp .env.example .env
(cd web && npm ci && npm run build)              # builds the site to web/out
.venv/bin/uvicorn app.main:app --app-dir api --port 8000
```

The API serves the built site at `/site`. To work on the site with hot reload, run the API with
`CORS_DEV_ORIGIN=http://localhost:3000`, then in `web/`: `NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev`
and open http://localhost:3000/site.

| Page | URL |
|---|---|
| Home | `/site/` |
| Savanna demo with the widget | `/savanna/pages/concept-with-navigation.html` |
| Jobs | `/site/jobs` |
| Staff console (needs `STAFF_TOKEN`) | `/site/staff` |
| Teacher view (needs `STAFF_TOKEN`) | `/site/teacher` |
| SMS simulator | `/site/sms-sim` |
| API reference | `/docs` (Swagger UI), `/openapi.json` |

To show a tap-to-call staff contact in the help widget, set `STAFF_CONTACT_PHONE` in `.env` to the real support number (international format recommended). `STAFF_CONTACT_LABEL` changes its button label. The widget hides this option when no valid phone number is configured; no sample number is shipped.

### Add it to any page (Level 1)

```html
<script src="https://YOUR-HOST/widget/walk-with-me.js" data-api="https://YOUR-HOST" data-lang="am" defer></script>
```

`data-lang` = `en` or `am`, `data-mode` = `normal` or `simple`, `data-offline-only="true"` skips the API and answers from `faq-bundle.js`. It also works when a page is opened from `file://`.

Level 2 is the REST API (`/openapi.json`, exported to `docs/openapi.json`). Level 3: `GET /v1/jobs?format=jsonld` returns schema.org `JobPosting`.

## Choosing the AI provider

| `AI_PROVIDER` | Needs | Notes |
|---|---|---|
| `offline` (default) | nothing | Returns the best matching human-written answer or course passage with its citation. Always the final fallback |
| `claude` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Official Anthropic Python SDK. Best Amharic. Amharic questions are turned into English search keywords before retrieval |
| `local` | `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL` | Any OpenAI-compatible server. `docker compose --profile local-ai up` starts Ollama; pull a model into it first. Small local models are weak in Amharic: use this for English |

Grounding rules, enforced in `api/app/chat_service.py`:

1. Top 4 passages are retrieved (BM25 over sections, FAQ, and jobs when the question is about jobs).
2. If the best passage covers less than `MIN_SCORE` of the question, the model is skipped and the learner gets "That is not in this course" plus **Talk to a person**.
3. The model sees only those passages and must return JSON with citation ids.
4. An answer with no citations, or citing an id that was not retrieved, is rejected, as is any error, refusal or a reply slower than `PROVIDER_TIMEOUT` (6 s). The offline answer is used instead, and the widget says "Answered without internet".

`GET /v1/status` shows which provider is configured and which one is actually answering.

## Amharic voice translation (optional)

The `/site/speech` page provides a keyboard- and screen-reader-accessible upload flow. `POST /v1/speech/translate` requires explicit consent, allows 15 MB / 2 minutes, limits each client to four requests per 15 minutes, holds the uploaded recording in a temporary file, and deletes it after processing. Results are returned to the browser and are not saved in the app database. A hosted translation endpoint receives the transcript text. Enable the feature with `SPEECH_TRANSLATION_ENABLED=1` only after configuring and validating the speech runtime and translation endpoint.

The backend pipeline in `api/app/speech_translation.py` transcribes Amharic audio with Addis AI's [Scribe Streaming model](https://huggingface.co/addisai/addis-scribe-streaming), resampling and downmixing every input to 16 kHz mono WAV first. It then translates the transcript with the documented Addis AI Amharic instruction fine-tune [Gemma 2 27B](https://huggingface.co/b1n1yam/gemma-2-27b-amharic-alpaca-sft). The standard NeMo Scribe checkpoint is about 2.5 GB. The translation card describes an early research release and does not report translation-specific evaluation, so have a fluent Amharic speaker review translations before relying on them.

Keep this separate from the regular API environment: NeMo and CUDA packages are large and are not required to run Walk With Me. Use a compatible Python 3.11/3.12 environment and install the optional requirements (NeMo also needs system audio libraries such as `libsndfile1` and `ffmpeg`):

```sh
python -m venv .venv-speech
.venv-speech/bin/pip install -r requirements-speech.txt
```

For translation, either set `HF_INFERENCE_ENDPOINT_URL` to a deployed Hugging Face Inference Endpoint that serves the selected model and `HF_TOKEN` if it is private, or use local translation on a CUDA GPU with at least 20 GiB free VRAM. Local weights load in 4-bit; there is no full-precision CPU fallback. The model is not currently deployed through Hugging Face Inference Providers, so a generic serverless model ID is not a substitute for an endpoint URL. The repository also contains a 499 MB Q5 GGUF Scribe export, but its report says NeMo parity, Amharic accuracy, and runtime/mobile behavior are unverified; this app keeps the documented NeMo checkpoint as its default until that smaller export is validated.

Run the CLI pipeline:

```sh
export HF_INFERENCE_ENDPOINT_URL=https://YOUR-ENDPOINT.endpoints.huggingface.cloud
export HF_TOKEN=YOUR_HF_TOKEN
.venv-speech/bin/python scripts/speech_translate.py recording.wav --target-language English
```

Set the endpoint variables in `.env` instead if you prefer; the CLI reads that file. Use `--json` for structured output and `--target-language` to choose the translation language (English is the default). The service function `translate_text()` also accepts a source language for text-to-text translation. First use downloads the 2.5 GB ASR checkpoint and, for local LLM mode, the translation weights. The model card uses OpenMDW-1.1 for Scribe and Apache-2.0 for the Gemma fine-tune; check each license and its terms before redistributing model weights.

To serve the upload feature in production, install `python-multipart` (included in the normal API requirements) plus `requirements-speech.txt`, install system `ffmpeg` and `libsndfile`, configure the translation endpoint, `SPEECH_TRANSLATION_ENABLED=1`, `APP_ENV=production` and `SPEECH_RATE_LIMIT_REDIS_URL`, and run one API worker for each local ASR model instance. The production route fails closed if Redis is not configured. For Docker Compose, set `SPEECH_RATE_LIMIT_REDIS_URL=redis://speech-rate-limit:6379/0`, build the opt-in image, then start Redis and the Nginx upload-size limit:

```sh
docker compose build --build-arg INSTALL_SPEECH_DEPS=1 api
docker compose --profile speech --profile speech-edge up
```

The API is bound to localhost port 8000; the included Nginx edge listens on 8080 and caps request bodies at 16 MB. Put your TLS/load-balancing proxy in front for a public deployment. The API image stays small by default. Provide enough memory and a compatible NVIDIA runtime for GPU inference when using local translation. Monitor model memory, latency and endpoint spend. If the host cannot run NeMo, keep the feature flag off until an ASR service is configured; the hosted translation endpoint handles only the text-to-text step.

## Telegram and SMS

- **Telegram:** create a bot with BotFather, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`. Add the bot to a staff group and set `TELEGRAM_STAFF_CHAT_ID`; new help requests are posted there, and staff can answer by replying to the bot's message. Long polling by default; set `TELEGRAM_MODE=webhook` with a public `PUBLIC_BASE_URL` for production. Commands: `/start`, `/help`, `/ai`, `/jobs`, `/alerts`, `/accommodation`, `/stop`.
- **SMS:** `SMS_GATEWAY=mock` sends nothing and shows messages in `/site/sms-sim.html`. `africastalking` is wired behind the same `SmsGateway` interface (`api/app/sms/`). **Not verified:** whether it delivers to Ethio Telecom and Safaricom Ethiopia numbers, and what a sender id costs. Inbound webhook: `POST /v1/sms/inbound` with `{"from": "...", "text": "..."}`. Commands: `HELP`, `ASK <question>`, `JOBS <type> <city>`, `ALERT <type> <city>` then `YES`, `STOP`.

## Privacy and deletion

Ethiopia's Personal Data Protection Proclamation No. 1321/2024 applies. What we collect, why, and when it is deleted:

| Data | Why | Deleted |
|---|---|---|
| Anonymous session id and chat text | Answer questions, give a person context | 7 days after the session starts (hourly purge), or at once with `DELETE /v1/me?session_id=…` |
| Place message the learner approved | Human help | With the request's messages, 30 days after it is resolved |
| Call-back phone number | Call the learner back | When the request is resolved or abandoned |
| Alert subscription and phone number / Telegram chat id | Send job alerts the learner asked for | On `STOP`, `/stop` or unsubscribe; contacts removed 30 days after opting out, or after 12 months with no alerts |
| Question text for the teacher view | Show which questions come up most | 90 days. Personal details are stripped and it has no link to a session |
| Consent and share events | Show consent was given | 90 days. They never hold content |
| Page snapshots | Show a helper the learner's page | Memory only, cleared when sharing stops or the request ends |
| Accommodation request text | — | Never stored |

- No names, no emails, no learner accounts. Session ids are random and kept on the device.
- Phone numbers used as SMS session references are hashed with `HMAC_SECRET`. `contacts.address` keeps the raw number only for people who opted in to alerts, because delivery needs it. Restrict permissions on the SQLite file (`var/walkwithme.db`, or the `wwm-db` volume).
- Admin deletion of a phone number: `sqlite3 var/walkwithme.db "DELETE FROM contacts WHERE address='+2519XXXXXXXX';"` (subscriptions and deliveries cascade).
- Back-ups are not set up. To copy the database: `docker compose cp api:/app/var/walkwithme.db ./backup.db`.
- Staff and teacher endpoints need the bearer `STAFF_TOKEN` and get no CORS headers. Public endpoints allow any origin and use no cookies.

## Content and Amharic

- **Every Amharic string must be written or checked by a native speaker.** None has been checked yet. Amharic UI strings are the starter strings from the design document and the widget marks them as unchecked. FAQ `answer_am` is empty, so an Amharic question gets the English answer with the note "Amharic answer not ready yet" rather than machine translation. Set `answer_am`, `body_am`, `term_pairs` and `verified_am` in `data/` once checked.
- To use the real Savanna starter: copy its pages into `savanna/`, run `python scripts/extract_course.py savanna/pages/<concept page>.html --inject` (on the copy) to add `wwm-sN` anchors and regenerate `data/course.json`, update the selectors in `widget/actions.js` from DevTools, then `python scripts/build_faq_bundle.py`.
- `data/jobs.json` is sample data with made-up employers, shown as "Sample job".

## Tests

```sh
.venv/bin/python -m pytest api/tests -q
```

Covers Amharic folding and punctuation, retrieval threshold (20 in-course questions in English and Amharic, 5 out-of-course), citation validation and the fallback chain, handoff flow and WebSocket, phone deletion on resolve, snapshot sanitising, job filters and JSON-LD, alert opt-in and no-duplicate delivery, SMS commands, teacher threshold, purge, Ethiopian dates. Browser tests are in `tests/e2e/` (`npm install`, then `BASE_URL=http://localhost:8000 npm test`; add `BROWSER_CHANNEL=msedge` or `chrome`, or run `npx playwright install chromium`). They cover axe-core on every page (fail on critical or serious), the jobs dialog steps, 320 px reflow, and a full learner-to-staff run: question, cited answer, Talk to a person, claim, chat both ways over WebSocket, page snapshot in a sandboxed iframe, resolve.

## Known limits and things to verify

- The Savanna pages here are a stand-in that copies the controls named in the starter README; selectors must be checked against the real starter.
- Ethiopian date conversion is tested against two Ethiopian New Years and a Pagume 6; **verify** the Amharic month spellings with a native speaker.
- Browser Amharic speech recognition and Amharic voices vary by phone. Text is always the full path. Test on the co-designer's phone.
- Live screen share uses public STUN only. Without a TURN server some networks fail; the page snapshot is the fallback and the mobile path.
- Rate limits are in memory (one process). Run one API container, or move them to a shared store.
- No accessibility results are claimed yet. `docs/conformance-report.md` must be filled in with what testing actually shows.

## Licence

To be confirmed with the organisers (ALX). Add the licence line here before submission.

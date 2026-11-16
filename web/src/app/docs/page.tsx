import type { Metadata } from "next";
import Link from "next/link";
import Toc from "@/components/docs/Toc";
import { CodeBlock, CtaBar } from "@/components/SiteChrome";
import { SAVANNA_DEMO } from "@/lib/api";
import s from "./docs.module.css";

export const metadata: Metadata = {
  title: "Install docs",
  description: "Install Walk With Me with one script tag, use the REST API, publish jobs as schema.org data, set up Telegram and SMS, and choose the AI provider.",
  openGraph: { title: "Install docs · Walk With Me", description: "One script tag, a REST API and open job data." },
};

const L1 = `<script src="https://walk-with-me-six.vercel.app/widget/walk-with-me.js"
        data-api="https://walk-with-me-six.vercel.app"
        data-lang="am"
        data-mode="normal"
        defer></script>`;
const CHAT = `curl -X POST https://walk-with-me-six.vercel.app/v1/chat \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Which skills do employers ask for?", "lang": "en", "mode": "normal"}'`;
const JOBS = `curl "https://walk-with-me-six.vercel.app/v1/jobs?city=Adama&supports=sign_language_interpreter"`;
const ERR = `{"error": {"code": "invalid_phone", "message": "That phone number is not in a format we can text.",
           "fix": "Use a number like 0911 234567, 0711 234567 or +251 911 234567."}}`;
const LD = `curl "https://walk-with-me-six.vercel.app/v1/jobs?format=jsonld"`;
const DOCKER = `cp .env.example .env      # set STAFF_TOKEN at least
docker compose up         # API, widget and pages on http://localhost:8000
docker compose --profile local-ai up   # also starts Ollama`;
const DELETE_PHONE = `sqlite3 var/walkwithme.db "DELETE FROM contacts WHERE address='+2519XXXXXXXX';"`;

const RETENTION: [string, string, string][] = [
  ["Anonymous session id and chat text", "Answer questions, give a person context", "7 days after the session starts, or at once with DELETE /v1/me?session_id=…"],
  ["Place message the learner approved", "Human help", "With the request's messages, 30 days after it is resolved"],
  ["Call-back phone number", "Call the learner back", "When the request is resolved or abandoned"],
  ["Alert subscription and phone number or Telegram chat id", "Send job alerts the learner asked for", "On STOP, /stop or unsubscribe. Contacts are removed 30 days after opting out, or after 12 months with no alerts"],
  ["Question text for the teacher view", "Show which questions come up most", "90 days. Personal details are stripped and it has no link to a session"],
  ["Consent and share events", "Show consent was given", "90 days. They never hold content"],
  ["Page snapshots", "Show a helper the learner's page", "Memory only, cleared when sharing stops or the request ends"],
  ["Accommodation request text", "Not kept", "Never stored"],
];

export default function DocsPage() {
  return (
    <main id="main" tabIndex={-1} className={`wrap ${s.docs}`}>
      <Toc className={`card ${s.toc}`} />

      <div className={s.body}>
        <h1>Install docs</h1>
        <p>Everything a platform owner needs to add Walk With Me to a site and keep it running.</p>

        <section id="install" aria-labelledby="h-install">
          <h2 id="h-install" className="highlight">Install in one line (Level 1)</h2>
          <p>Add this before the closing body tag on every page. The helper appears in the same corner on every page.</p>
          <CodeBlock code={L1} label="Script tag" />
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Script tag attributes</caption>
              <thead><tr><th scope="col">Attribute</th><th scope="col">Values</th><th scope="col">What it does</th></tr></thead>
              <tbody>
                <tr><td><code>data-api</code></td><td>URL, or empty</td><td>Where the API runs. Empty means the same site as the page.</td></tr>
                <tr><td><code>data-lang</code></td><td><code>en</code>, <code>am</code></td><td>Starting language. The learner can switch it.</td></tr>
                <tr><td><code>data-mode</code></td><td><code>normal</code>, <code>simple</code></td><td>Simple mode: short sentences, one step at a time, read aloud.</td></tr>
                <tr><td><code>data-offline-only</code></td><td><code>true</code></td><td>Never call the API. Answers come from the built-in course questions only.</td></tr>
              </tbody>
            </table>
          </div>
          <p>The helper works on pages opened from a file, because the offline answers are a script file, not a data request.</p>
        </section>

        <section id="api" aria-labelledby="h-api">
          <h2 id="h-api" className="highlight">REST API (Level 2)</h2>
          <p>Every feature has an endpoint. Read the interactive reference at <a href="/docs">/docs</a> or download the <a href="/openapi.json">OpenAPI document</a>.</p>
          <p>Ask a question:</p>
          <CodeBlock code={CHAT} label="Chat example" />
          <p>The answer comes with <code>citations</code> (section title and link), <code>provider</code> and <code>answered_offline</code>. If nothing in the course matches, <code>not_in_course</code> is true and <code>handoff_suggested</code> offers a person.</p>
          <p>List jobs with a support filter:</p>
          <CodeBlock code={JOBS} label="Jobs example" />
          <p>Errors always look like this, so you can show them to people as they are:</p>
          <pre className={s.plain} tabIndex={0} aria-label="Error shape"><code>{ERR}</code></pre>
        </section>

        <section id="jsonld" aria-labelledby="h-jsonld">
          <h2 id="h-jsonld" className="highlight">Jobs as schema.org data (Level 3)</h2>
          <p>Add <code>format=jsonld</code> to get the job list as <code>schema.org/JobPosting</code> objects. Job boards and search engines can read them. Supports offered are listed in <code>jobBenefits</code>.</p>
          <CodeBlock code={LD} label="JSON-LD example" />
        </section>

        <section id="show-me" aria-labelledby="h-show-me">
          <h2 id="h-show-me" className="highlight">Show me where</h2>
          <p>A learner asks where something is, for example &quot;where do I finish this lesson?&quot;. The helper matches the question to an action, scrolls to the control, moves keyboard focus to it, draws a ring with a label badge and reads out &quot;Found it: Mark as complete. Press Enter to use it.&quot; The ring clears when focus moves on or after 10 seconds.</p>
          <ul>
            <li>The helper never clicks for the learner. It moves focus; the learner acts.</li>
            <li>If the control is on another page, the helper says so and offers a link to that page.</li>
            <li>Actions and their CSS selectors live in <code>widget/actions.js</code>. Fill in the selectors for your own pages from the browser&apos;s developer tools.</li>
          </ul>
        </section>

        <section id="human-help" aria-labelledby="h-human-help">
          <h2 id="h-human-help" className="highlight">Talk to a person</h2>
          <p>The <strong>Talk to a person</strong> button is always in the helper panel. The learner chooses chat, voice call-back or phone call-back.</p>
          <ol>
            <li>The helper shows the place message: page title, section, the focused control, the last error and the last 3 messages. The learner can change it. Nothing is sent before they press Send.</li>
            <li>The request appears in the <Link href="/staff">staff console</Link> and, if set up, in a staff Telegram group.</li>
            <li>A helper claims it and they chat. If nobody claims it within 60 seconds, the learner is told their place in line.</li>
            <li>A helper can ask to see the page. The learner decides. <strong>Share page view</strong> sends a read-only copy of the page with inputs masked and scripts removed. A <strong>Stop sharing</strong> button is the first thing in the panel while sharing.</li>
            <li>Helpers never get control of the learner&apos;s device. A call-back number is deleted when the request ends.</li>
          </ol>
        </section>

        <section id="answers" aria-labelledby="h-answers">
          <h2 id="h-answers" className="highlight">Answers and languages</h2>
          <ul>
            <li>Answers come from the course only. Every answer cites at least one course section, with a <strong>Take me there</strong> link.</li>
            <li>If nothing in the course matches, the helper says &quot;That is not in this course&quot; and offers a person or jobs.</li>
            <li>Learners can ask in Amharic or English. Amharic answers put the English course term in brackets beside it.</li>
            <li>Amharic course text must be written or checked by a native speaker. Until it is, the helper gives the English answer and says the Amharic answer is not ready, rather than showing unchecked machine translation.</li>
          </ul>
        </section>

        <section id="channels" aria-labelledby="h-channels">
          <h2 id="h-channels" className="highlight">Telegram and SMS</h2>
          <h3>Telegram</h3>
          <ol>
            <li>Create a bot with BotFather and copy its token.</li>
            <li>Set <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_BOT_USERNAME</code>.</li>
            <li>For staff notices, add the bot to a staff group and set <code>TELEGRAM_STAFF_CHAT_ID</code>. Staff answer a learner by replying to the bot&apos;s message.</li>
            <li>On a laptop the bot uses long polling. On a server set <code>TELEGRAM_MODE=webhook</code> and <code>PUBLIC_BASE_URL</code>; the webhook is <code>/v1/telegram/webhook</code>.</li>
          </ol>
          <p>Commands: <code>/start</code>, <code>/help</code>, <code>/jobs</code>, <code>/alerts</code>, <code>/accommodation</code>, <code>/stop</code>.</p>
          <h3>SMS</h3>
          <p>By default <code>SMS_GATEWAY=mock</code>: nothing is sent, and every message appears in the <Link href="/sms-sim">SMS simulator</Link>. To send real messages set <code>SMS_GATEWAY=africastalking</code> with <code>AFRICASTALKING_USERNAME</code>, <code>AFRICASTALKING_API_KEY</code> and, if you have one, <code>AFRICASTALKING_SENDER_ID</code>. Check first that your provider delivers to Ethio Telecom and Safaricom Ethiopia numbers.</p>
          <p>Point the provider&apos;s inbound webhook at <code>POST /v1/sms/inbound</code>. Learners send <code>HELP</code>, <code>ASK</code> and a question, <code>JOBS driver adama</code>, <code>ALERT driver adama</code> or <code>STOP</code>.</p>
        </section>

        <section id="ai" aria-labelledby="h-ai">
          <h2 id="h-ai" className="highlight">Choosing the AI provider</h2>
          <p>Set <code>AI_PROVIDER</code>. Whatever you choose, the offline provider is the fallback: if the model fails, is slow (more than 6 seconds) or cites something that was not retrieved, the answer comes from the human-written course questions instead.</p>
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">AI providers</caption>
              <thead><tr><th scope="col">Value</th><th scope="col">Needs</th><th scope="col">Notes</th></tr></thead>
              <tbody>
                <tr><td><code>offline</code></td><td>Nothing</td><td>Returns the best matching human-written answer and its source. Always works.</td></tr>
                <tr><td><code>claude</code></td><td><code>ANTHROPIC_API_KEY</code>, <code>ANTHROPIC_MODEL</code></td><td>Cloud model. Best for Amharic.</td></tr>
                <tr><td><code>local</code></td><td><code>LOCAL_LLM_URL</code>, <code>LOCAL_LLM_MODEL</code></td><td>Any OpenAI-compatible server, such as Ollama. Small local models are weak in Amharic; use it for English.</td></tr>
              </tbody>
            </table>
          </div>
          <p>Other settings: <code>MIN_SCORE</code> (how closely a question must match the course, default 0.35), <code>K_MIN</code> (how many times a question must be asked before the teacher view shows it, default 3), <code>STAFF_TOKEN</code> (staff console and teacher view), <code>PUBLIC_BASE_URL</code> (links in alerts).</p>
        </section>

        <section id="docker" aria-labelledby="h-docker">
          <h2 id="h-docker" className="highlight">Run with Docker Compose</h2>
          <CodeBlock code={DOCKER} label="Docker commands" />
          <p>It works with only <code>AI_PROVIDER=offline</code>. Health check: <code>/healthz</code>.</p>
        </section>

        <section id="privacy" aria-labelledby="h-privacy">
          <h2 id="h-privacy" className="highlight">Privacy and deletion</h2>
          <p>Ethiopia&apos;s Personal Data Protection Proclamation No. 1321/2024 applies. What we collect, why, and when it is deleted:</p>
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">What is collected and when it is deleted</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Why</th><th scope="col">Deleted</th></tr></thead>
              <tbody>
                {RETENTION.map(([d, why, del]) => <tr key={d}><td>{d}</td><td>{why}</td><td>{del}</td></tr>)}
              </tbody>
            </table>
          </div>
          <ul>
            <li>No names, no emails, no learner accounts. Session ids are random and kept on the device.</li>
            <li>A learner can delete their session data at once with <code>DELETE /v1/me?session_id=…</code>.</li>
            <li>Phone numbers used as SMS session references are hashed with <code>HMAC_SECRET</code>. The raw number is kept only for people who opted in to alerts, because delivery needs it. Restrict permissions on the SQLite file.</li>
            <li>Back-ups are not set up. To copy the database: <code>docker compose cp api:/app/var/walkwithme.db ./backup.db</code>.</li>
            <li>Staff and teacher endpoints need the bearer <code>STAFF_TOKEN</code>. Public endpoints allow any origin and use no cookies.</li>
          </ul>
          <p>An admin deletes a phone number (subscriptions and deliveries go with it) like this:</p>
          <CodeBlock code={DELETE_PHONE} label="Delete a phone number" />
        </section>

        <section id="a11y" aria-labelledby="h-a11y">
          <h2 id="h-a11y" className="highlight">Accessibility statement</h2>
          <p>We aim for WCAG 2.2 level AA on the helper, these pages, the staff console and the teacher view.</p>
          <p>Testing with screen readers (NVDA and TalkBack), keyboard only, 200% zoom and sound off is still in progress. Results, including what does not work yet, are in <code>docs/conformance-report.md</code> in the code repository. We do not claim conformance until that report is filled in with real results.</p>
          <p>If something does not work for you, press Talk to a person in the helper, or tell the hackathon organisers.</p>
        </section>
      </div>
      <CtaBar href={SAVANNA_DEMO} label="Try it on Savanna" external />
    </main>
  );
}

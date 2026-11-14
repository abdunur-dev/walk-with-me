"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { FieldError, errorText } from "./ui";
import styles from "./console.module.css";

type Out = { to: string; text: string; at: string; segments: number };
type Bubble = { key: string; text: string; dir: "out" | "in"; note?: string };

const PHONE_RE = /^(?:\+251|251|0)[79]\d{8}$/;
const phoneOk = (v: string) => PHONE_RE.test(v.replace(/[\s\-()]/g, ""));
const PHONE_FIX = "Use a number like 0911 234567, 0711 234567 or +251 911 234567.";

const QUICK = [
  { label: "HELP", cmd: "HELP" },
  { label: "ASK …", cmd: "ASK which skills do employers ask for" },
  { label: "JOBS driver adama", cmd: "JOBS driver adama" },
  { label: "ALERT driver adama", cmd: "ALERT driver adama" },
  { label: "YES", cmd: "YES" },
  { label: "STOP", cmd: "STOP" },
];

export default function SmsSimulator() {
  const [from, setFrom] = useState("0911000000");
  const [text, setText] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [fromErr, setFromErr] = useState<string | null>(null);
  const [textErr, setTextErr] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const threadRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [bubbles]);

  const pollOutbox = useCallback((initial: boolean) => {
    const f = from.trim();
    if (!phoneOk(f)) return;
    api<{ items: Out[] }>(`/v1/sms/outbox?to=${encodeURIComponent(f)}`).then((d) => {
      const fresh: Bubble[] = [];
      for (const m of d.items) {
        const k = `${m.at}|${m.text}`;
        if (seen.current.has(k)) continue;
        seen.current.add(k);
        if (!initial) fresh.push({ key: k, text: m.text, dir: "in", note: m.segments > 1 ? `${m.segments} SMS parts` : undefined });
      }
      if (fresh.length) setBubbles((b) => [...b, ...fresh]);
    }, () => { /* simulator only: ignore */ });
  }, [from]);

  // Reset the thread when the number changes, then poll for replies and alerts.
  useEffect(() => {
    seen.current = new Set();
    setBubbles([]);
    pollOutbox(true);
    const t = window.setInterval(() => pollOutbox(false), 4000);
    return () => window.clearInterval(t);
  }, [pollOutbox]);

  const send = (msg: string) => {
    const f = from.trim();
    if (!phoneOk(f)) {
      setFromErr(`That phone number is not in a format we know. ${PHONE_FIX}`);
      fromRef.current?.focus();
      return;
    }
    setFromErr(null);
    if (!msg) { setTextErr("Type a message first."); textRef.current?.focus(); return; }
    setTextErr(null);
    counter.current += 1;
    setBubbles((b) => [...b, { key: `out${counter.current}`, text: msg, dir: "out" }]);
    api("/v1/sms/inbound", { body: { from: f, text: msg } }).then(
      () => { setStatus(""); pollOutbox(false); },
      (err) => setStatus(errorText(err)),
    );
  };

  return (
    <div className={styles.sim}>
      <div>
        <p><strong>Simulator. No real messages are sent.</strong></p>
        <p>Type a command as a learner with no data would. Replies and alerts appear in the phone.</p>
        <div className={`field${fromErr ? " field-error" : ""}`}>
          <label htmlFor="from">Your phone number</label>
          <span className="hint" id="from-hint">09… or 07… or +251…</span>
          <input id="from" ref={fromRef} className="input" type="tel" inputMode="tel" value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-describedby={fromErr ? "from-hint from-err" : "from-hint"} aria-invalid={fromErr ? true : undefined} />
          <FieldError id="from-err" text={fromErr} />
        </div>
        <div className="section-head" style={{ marginBlockEnd: "var(--space-4)" }}>
          <h2 className="highlight">Commands</h2>
        </div>
        <ul className={styles.commands}>
          <li><code>HELP</code>: a person calls you back</li>
          <li><code>ASK</code> and a question: a short answer from the course</li>
          <li><code>JOBS driver adama</code>: up to 3 jobs</li>
          <li><code>ALERT driver adama</code>, then <code>YES</code>: job alerts</li>
          <li><code>STOP</code>: stop alerts</li>
        </ul>
      </div>

      <section className={styles.phone} aria-labelledby="phone-title">
        <h2 id="phone-title" className={styles.phoneTitle}>Messages</h2>
        <div id="thread" ref={threadRef} className={styles.thread} role="log" aria-live="polite" aria-label="SMS conversation">
          <ol className={styles.threadList}>
          {bubbles.map((b) => (
            <li key={b.key} className={b.dir === "out" ? styles.out : styles.in} dir="auto">
              <span className="visually-hidden">{b.dir === "out" ? "You sent: " : "Reply: "}</span>
              {b.text}
              {b.note && <span className={styles.parts}>{b.note}</span>}
            </li>
          ))}
          </ol>
        </div>
        <div className={styles.quick} role="group" aria-label="Quick commands">
          {QUICK.map((q) => (
            <button key={q.cmd} type="button" className="chip" onClick={() => send(q.cmd)}>{q.label}</button>
          ))}
        </div>
        <form id="send" noValidate onSubmit={(e) => { e.preventDefault(); const t = text.trim(); send(t); if (t) setText(""); }}>
          <div className={`field${textErr ? " field-error" : ""}`}>
            <label htmlFor="text">Message</label>
            <input id="text" ref={textRef} className="input" maxLength={480} autoComplete="off" value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={textErr ? "text-err" : undefined} aria-invalid={textErr ? true : undefined} />
            <FieldError id="text-err" text={textErr} />
          </div>
          <button type="submit" className="btn btn-primary">Send</button>
          <div id="status" role="alert">{status && <p className="error-text"><span>{status}</span></p>}</div>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";
import { FieldError, TokenForm, errorText, readToken, saveToken, useAnnouncer } from "./ui";
import styles from "./console.module.css";

type QueueItem = {
  id: string; status: string; contact_pref: string; waiting_seconds: number; mine: boolean; lang: string;
  page_title: string | null; section: string | null;
};
type Msg = { id: number; sender: "learner" | "staff" | "system"; text: string; created_at?: string };
type Detail = {
  id: string; status: string; contact_pref: string; callback_phone: string | null; claimed_by_me: boolean;
  place: { page_title?: string; section?: string; note?: string }; place_text: string; messages: Msg[];
  snapshot: { html: string; title?: string | null; at: string } | null;
};

const PREF: Record<string, string> = { chat: "Chat", voice_callback: "Voice call-back", phone_callback: "Phone call-back" };
const waitText = (s: number) => (s < 60 ? "Waiting under 1 min" : `Waiting ${Math.floor(s / 60)} min`);

export default function StaffConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [queueStatus, setQueueStatus] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [dStatus, setDStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState("");
  const [note, setNote] = useState("");
  const [resolveStatus, setResolveStatus] = useState("");
  const { announce, region } = useAnnouncer();

  const currentRef = useRef<string | null>(null);
  const lastIdRef = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const queueTitleRef = useRef<HTMLHeadingElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const focusTitle = useRef(false);

  const call = useCallback(<T,>(path: string, body?: unknown) => api<T>(path, { token, body }), [token]);

  const addMessages = useCallback((list: Msg[]) => {
    const fresh = list.filter((m) => !m.id || m.id > lastIdRef.current);
    if (!fresh.length) return;
    for (const m of fresh) if (m.id) lastIdRef.current = Math.max(lastIdRef.current, m.id);
    setMessages((old) => [...old, ...fresh]);
  }, []);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [messages]);

  // Restore the token from this tab.
  useEffect(() => { const t = readToken(); if (t) setToken(t); }, []);

  // Sign in when there is a token.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ display_name: string }>("/v1/staff/me", { token }).then(
      (r) => { if (!cancelled) { setMe(r.display_name); setLoginError(""); } },
      (err) => { if (!cancelled) { saveToken(null); setToken(null); setMe(null); setLoginError(errorText(err)); } },
    );
    return () => { cancelled = true; };
  }, [token]);

  const loadQueue = useCallback(() => {
    call<{ items: QueueItem[] }>("/v1/staff/handoffs").then((d) => { setQueue(d.items); setQueueStatus(""); }, (err) => setQueueStatus(errorText(err)));
  }, [call]);

  useEffect(() => {
    if (!me) return;
    setQueueStatus(`Signed in as ${me}.`);
    loadQueue();
    const t = window.setInterval(loadQueue, 5000);
    if (window.location.hash.length > 1) setCurrent(decodeURIComponent(window.location.hash.slice(1)));
    return () => window.clearInterval(t);
  }, [me, loadQueue]);

  const refreshDetail = useCallback(() => {
    const id = currentRef.current;
    if (!id) return;
    call<Detail>(`/v1/staff/handoffs/${encodeURIComponent(id)}?after=${lastIdRef.current}`).then((d) => {
      if (id !== currentRef.current) return;
      setDetail(d);
      addMessages(d.messages);
    }, (err) => setDStatus(errorText(err)));
  }, [call, addMessages]);

  // Open a request: load it, poll every 5 s (fallback), and listen on the WebSocket.
  useEffect(() => {
    currentRef.current = current;
    if (!current || !me) return;
    lastIdRef.current = 0;
    setMessages([]);
    setDetail(null);
    setDStatus("");
    focusTitle.current = true;
    window.history.replaceState(null, "", "#" + encodeURIComponent(current));
    refreshDetail();
    loadQueue();
    const poll = window.setInterval(refreshDetail, 5000);
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(`/v1/handoff/${encodeURIComponent(current)}/ws?token=${encodeURIComponent(token ?? "")}`));
      ws.onmessage = (ev) => {
        let m: { type: string; message?: Msg; action?: string };
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === "message" && m.message) addMessages([m.message]);
        else if (m.type === "status" || m.type === "snapshot" || m.type === "share") {
          refreshDetail();
          if (m.type === "share" && m.action === "stopped") announce("The learner stopped sharing.");
          if (m.type === "share" && m.action === "declined") announce("The learner chose not to share.");
          if (m.type === "snapshot") announce("New page view from the learner.");
        } else if (m.type === "typing") announce("The learner is typing.");
      };
    } catch { /* polling covers it */ }
    return () => { window.clearInterval(poll); try { ws?.close(); } catch { /* closed */ } };
  }, [current, me, token, refreshDetail, loadQueue, addMessages, announce]);

  useEffect(() => {
    if (detail && focusTitle.current) { focusTitle.current = false; titleRef.current?.focus(); }
  }, [detail]);

  if (!me) {
    return (
      <>
        <TokenForm button="Open the console" error={loginError} onSubmit={(t) => { saveToken(t); setLoginError(""); setToken(t); }} />
        {region}
      </>
    );
  }

  const closed = detail ? detail.status === "resolved" || detail.status === "abandoned" : false;
  const statusText = !detail ? "" : detail.status === "open" ? "Waiting for someone to claim it."
    : detail.status === "claimed" ? (detail.claimed_by_me ? "You are helping." : "Someone else is helping.")
    : `This request is ${detail.status}.`;

  return (
    <div id="console" className={`${styles.console}${current ? ` ${styles.hasDetail}` : ""}`}>
      {region}
      <section className={styles.queuePane} aria-labelledby="queue-title">
        <h2 id="queue-title" ref={queueTitleRef} tabIndex={-1}>Requests</h2>
        <p id="queue-status" role="status" aria-live="polite">{queueStatus}</p>
        {queue && <p className={styles.queueSummary}>{queue.filter((r) => r.status === "open").length} waiting · {queue.filter((r) => r.status === "claimed").length} being helped</p>}
        <ul id="queue" className={styles.queue}>
          {queue && !queue.length && <li>No open requests.</li>}
          {queue?.map((r) => {
            const long = r.status === "open" && r.waiting_seconds >= 180;
            const meta = r.status === "open" ? waitText(r.waiting_seconds) : r.mine ? "Claimed by you" : "Claimed";
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`${styles.req}${long ? ` ${styles.waitingLong}` : ""}`}
                  aria-current={current === r.id ? "true" : undefined}
                  onClick={() => setCurrent(r.id)}
                >
                  <strong>{(r.page_title || "Unknown page") + (r.section ? `: ${r.section}` : "")}</strong>
                  {meta} · {PREF[r.contact_pref] || r.contact_pref} · {r.lang === "am" ? "Amharic" : "English"}
                </button>
              </li>
            );
          })}
        </ul>
        <p>
          <button type="button" id="logout" className="btn btn-quiet btn-small"
            onClick={() => { saveToken(null); window.location.reload(); }}>Sign out of this tab</button>
        </p>
      </section>

      <section className={styles.detailPane} aria-labelledby={current ? "d-title" : "detail-title"}>
        {!current && (
          <div id="no-detail" className="card">
            <h2 id="detail-title" tabIndex={-1}>Pick a request</h2>
            <p>Open requests are listed oldest first.</p>
          </div>
        )}
        {current && (
          <div id="detail">
            <button type="button" className="btn btn-quiet btn-small" id="back-to-list"
              onClick={() => {
                setCurrent(null);
                window.history.replaceState(null, "", window.location.pathname);
                window.setTimeout(() => queueTitleRef.current?.focus(), 0);
              }}>Back to requests</button>
            <h2 id="d-title" ref={titleRef} tabIndex={-1}>
              {detail ? (detail.place.page_title || "Request") + (detail.place.section ? `: ${detail.place.section}` : "") : "Request"}
            </h2>
            <p id="d-status" role="status" aria-live="polite">{dStatus || statusText}</p>
            <div className="card" style={{ marginBlockEnd: "var(--space-5)" }}>
              <h3>Place message the learner approved</h3>
              <pre id="d-place" className={styles.place} tabIndex={0} aria-label="Place message">{detail?.place_text ?? ""}</pre>
              {detail?.place.note && <p id="d-note">Learner added: {detail.place.note}</p>}
              {detail?.callback_phone && (
                <p id="d-phone">{PREF[detail.contact_pref]} number: <a href={`tel:${detail.callback_phone}`}>{detail.callback_phone}</a>. Deleted when you resolve.</p>
              )}
            </div>
            <div className="actions" style={{ marginBlockEnd: "var(--space-5)" }}>
              {detail?.status === "open" && (
                <button type="button" className="btn btn-primary" id="claim"
                  onClick={() => call(`/v1/staff/handoffs/${encodeURIComponent(current)}/claim`, {}).then(
                    () => { refreshDetail(); loadQueue(); msgRef.current?.focus(); },
                    (err) => setDStatus(errorText(err)))}>Claim</button>
              )}
              {!closed && (
                <button type="button" className="btn btn-secondary" id="ask-share"
                  onClick={() => call(`/v1/staff/handoffs/${encodeURIComponent(current)}/request-share`, {}).then(
                    () => setDStatus("Asked. The learner chooses whether to share."),
                    (err) => setDStatus(errorText(err)))}>Ask to see their screen</button>
              )}
            </div>

            <h3 id="chat-title">Chat</h3>
            <div id="chat" ref={chatRef} className={styles.chat} role="log" aria-live="polite" aria-labelledby="chat-title">
              <ol className={styles.chatList}>
              {messages.map((m, i) => (
                <li key={m.id || `x${i}`} className={styles[`msg_${m.sender}`]} dir="auto">
                  {m.sender === "learner" ? "Learner: " : m.sender === "staff" ? "You: " : ""}{m.text}
                </li>
              ))}
              </ol>
            </div>

            {!closed && (
              <form id="send-form" noValidate onSubmit={(e) => {
                e.preventDefault();
                const text = msg.trim();
                if (!text) { setMsgErr("Type a message first."); msgRef.current?.focus(); return; }
                setMsgErr(null);
                call<Msg>(`/v1/staff/handoffs/${encodeURIComponent(current)}/messages`, { text }).then((m) => {
                  addMessages([m]); setMsg(""); setSendStatus(""); msgRef.current?.focus();
                }, (err) => setSendStatus(errorText(err)));
              }}>
                <div className={`field${msgErr ? " field-error" : ""}`}>
                  <label htmlFor="msg">Message to the learner</label>
                  <textarea id="msg" ref={msgRef} className="input" rows={3} maxLength={2000} style={{ minBlockSize: "6rem" }}
                    value={msg} onChange={(e) => setMsg(e.target.value)}
                    aria-describedby={msgErr ? "msg-err" : undefined} aria-invalid={msgErr ? true : undefined} />
                  <FieldError id="msg-err" text={msgErr} />
                </div>
                <button type="submit" className="btn btn-secondary">Send</button>
                <div id="send-status" role="alert">{sendStatus && <p className="error-text"><span>{sendStatus}</span></p>}</div>
              </form>
            )}

            {detail?.snapshot && (
              <div className={styles.snapshot} id="snap-wrap">
                <h3>Their page view</h3>
                <p id="snap-time">
                  Sent at {detail.snapshot.at} UTC{detail.snapshot.title ? ` from ${detail.snapshot.title}` : ""}. The learner sends a new one when they press Update view.
                </p>
                <iframe id="snap" sandbox="" srcDoc={detail.snapshot.html}
                  title="Read-only snapshot of the learner's page. Inputs are hidden." />
              </div>
            )}

            {!closed && (
              <form id="resolve-form" className="card" noValidate style={{ marginBlockStart: "var(--space-5)" }} onSubmit={(e) => {
                e.preventDefault();
                call(`/v1/staff/handoffs/${encodeURIComponent(current)}/resolve`, { note: note.trim() || null }).then(() => {
                  setResolveStatus(""); refreshDetail(); loadQueue(); announce("Request resolved.");
                }, (err) => setResolveStatus(errorText(err)));
              }}>
                <div className="field">
                  <label htmlFor="note">Note for the team (optional, one line, no personal details)</label>
                  <input id="note" className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-secondary">Resolve</button>
                <div id="resolve-status" role="alert">{resolveStatus && <p className="error-text"><span>{resolveStatus}</span></p>}</div>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

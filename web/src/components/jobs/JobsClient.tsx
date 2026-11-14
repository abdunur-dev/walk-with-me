"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getPref } from "@/lib/prefs";
import s from "./jobs.module.css";

type Opt = { id: string; label: string };
type Meta = { categories: Opt[]; cities: string[]; supports: Opt[] };
type Job = {
  id: string; title: string; employer: string; city: string; summary_simple: string; apply_url: string | null;
  deadline: string | null; deadline_ethiopian?: { label_en: string }; supports: string[]; supports_labels: string[];
};
type Draft = { text_en: string; text_am: string | null; am_note?: string; subject_en: string; contact_hint: string | null };
type Problem = { message: string; fix?: string };
type Rules = Record<string, (v: string) => string | null>;

const PHONE_FIX = "Use a number like 0911 234567, 0711 234567 or +251 911 234567.";
const phoneOk = (v: string) => /^(?:\+251|251|0)[79]\d{8}$/.test(v.replace(/[\s\-()]/g, ""));
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const sentenceList = (items: string[]) =>
  items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
const lang = () => (getPref("wwm.lang") === "am" ? "am" : "en");
const toProblem = (e: unknown): Problem =>
  e instanceof ApiError ? { message: e.message, fix: e.fix } : { message: String((e as Error)?.message ?? e) };

const ADJUSTMENTS: Opt[] = [
  { id: "sign_language_interpreter", label: "Sign language interpreter" },
  { id: "step_free", label: "Step-free access" },
  { id: "written_interview_questions", label: "Questions in writing beforehand" },
  { id: "extra_time", label: "Extra time" },
  { id: "screen_reader_test", label: "Screen-reader-friendly test" },
  { id: "quiet_room", label: "Quiet room" },
  { id: "large_print_materials", label: "Large print materials" },
];

/* ───────── Small pieces ───────── */
function StatusBox({ id, problem, children, role = "status" }: { id: string; problem?: Problem | null; children?: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <div id={id} className={s.status} role={role} aria-live={role === "status" ? "polite" : undefined}>
      {problem ? (
        <>
          <p className={s.problem}>Problem: {problem.message}</p>
          {problem.fix ? <p>{problem.fix}</p> : null}
        </>
      ) : children}
    </div>
  );
}

/** Validation: errors under fields (aria-describedby), summary box that receives focus, input never cleared. */
function useValidation(rules: Rules) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ id: string; msg: string }[]>([]);
  const [tick, setTick] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (tick && summary.length) summaryRef.current?.focus(); }, [tick, summary.length]);

  const validate = (values: Record<string, string>, skip: string[] = []) => {
    const next: Record<string, string> = {};
    const list: { id: string; msg: string }[] = [];
    for (const id of Object.keys(rules)) {
      if (skip.includes(id)) continue;
      const msg = rules[id](values[id]?.trim() ?? "");
      if (msg) { next[id] = msg; list.push({ id, msg }); }
    }
    setErrors(next); setSummary(list); setTick((t) => t + 1);
    return list.length === 0;
  };
  const blur = (id: string, value: string) => {
    const v = value.trim();
    if (v === "" && !errors[id]) return; // do not nag on first pass
    const msg = rules[id](v);
    setErrors((e) => { const n = { ...e }; if (msg) n[id] = msg; else delete n[id]; return n; });
  };
  const fieldProps = (id: string, hintId?: string) => ({
    id,
    "aria-invalid": errors[id] ? (true as const) : undefined,
    "aria-describedby": [hintId, errors[id] ? `${id}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const Err = ({ id }: { id: string }) => (errors[id] ? <p id={`${id}-error`} className="error-text">Problem: {errors[id]}</p> : null);
  const Summary = () =>
    summary.length ? (
      <div className="error-summary" tabIndex={-1} role="alert" ref={summaryRef}>
        <h2>{summary.length === 1 ? "There is 1 problem" : `There are ${summary.length} problems`}</h2>
        <ul>
          {summary.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(p.id)?.focus(); }}>{p.msg}</a>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return { errors, validate, blur, fieldProps, Err, Summary, clear: () => { setErrors({}); setSummary([]); } };
}

/* ───────── Page ───────── */
export default function JobsClient() {
  const [meta, setMeta] = useState<Meta>({ categories: [], cities: [], supports: [] });
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [supports, setSupports] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [showing, setShowing] = useState("");
  const [resultsError, setResultsError] = useState<Problem | null>(null);

  const supportLabel = useCallback((id: string) => meta.supports.find((x) => x.id === id)?.label ?? id, [meta.supports]);
  const categoryLabel = (id: string) => meta.categories.find((x) => x.id === id)?.label ?? "any job type";

  useEffect(() => {
    api<Meta>("/v1/jobs/meta").then(setMeta, (e) => setResultsError(toProblem(e)));
  }, []);

  useEffect(() => {
    if (!meta.categories.length) return;
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (city) p.set("city", city);
    if (supports.length) p.set("supports", supports.join(","));
    setResultsError(null);
    api<{ items: Job[]; count: number }>("/v1/jobs?" + p.toString()).then((d) => {
      setJobs(d.items);
      const parts = [d.count === 1 ? "Showing 1 job" : `Showing ${d.count} jobs`];
      if (supports.length) parts.push("that offer: " + sentenceList(supports.map((x) => lowerFirst(supportLabel(x)))));
      setShowing(parts.join(" ") + ".");
    }, (e) => setResultsError(toProblem(e)));
  }, [meta.categories.length, category, city, supports, supportLabel]);

  const clearFilters = () => {
    setCategory(""); setCity(""); setSupports([]);
    setShowing("Filters cleared.");
  };

  /* ───────── Alerts ───────── */
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [aCategory, setACategory] = useState("any");
  const [aCity, setACity] = useState("any");
  const [aSupports, setASupports] = useState<string[]>([]);
  const [channel, setChannel] = useState<"telegram" | "sms">("telegram");
  const [aPhone, setAPhone] = useState("");
  const [aStatus, setAStatus] = useState<{ text?: string; link?: string | null; problem?: Problem } | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cStatus, setCStatus] = useState<{ text?: string; problem?: Problem } | null>(null);
  const [sPhone, setSPhone] = useState("");
  const [sStatus, setSStatus] = useState<{ text?: string; problem?: Problem } | null>(null);
  const aCategoryRef = useRef<HTMLSelectElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const alertsTitleRef = useRef<HTMLHeadingElement>(null);
  const [focusAlerts, setFocusAlerts] = useState(0);

  const alertV = useValidation({
    "a-phone": (v) => {
      if (channel !== "sms") return null;
      if (!v) return "Enter the phone number for SMS alerts.";
      return phoneOk(v) ? null : `That phone number is not in a format we can text. ${PHONE_FIX}`;
    },
  });
  const codeV = useValidation({ "c-code": (v) => (/^\d{6}$/.test(v) ? null : "Type the 6 digits from the SMS.") });
  const stopV = useValidation({
    "s-phone": (v) => (!v ? "Enter the phone number you get alerts on." : phoneOk(v) ? null : `That phone number is not in a format we know. ${PHONE_FIX}`),
  });

  useEffect(() => {
    if (!focusAlerts) return;
    alertsTitleRef.current?.scrollIntoView({ block: "start" });
    aCategoryRef.current?.focus();
  }, [focusAlerts]);
  const openAlerts = () => { setAlertsOpen(true); setFocusAlerts((n) => n + 1); };

  const submitAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertV.validate({ "a-phone": aPhone }, channel === "sms" ? [] : ["a-phone"])) return;
    const body: Record<string, unknown> = { channel, category: aCategory, city: aCity, lang: lang(), supports_needed: aSupports };
    if (channel === "sms") body.phone = aPhone.trim();
    setAStatus({ text: "Starting…" });
    try {
      const r = await api<{ message: string; channel: string; telegram_link?: string | null }>("/v1/alerts/subscribe", { body });
      setAStatus({ text: r.message, link: r.channel === "telegram" ? r.telegram_link : null });
      if (r.channel === "sms") { setPendingPhone(aPhone.trim()); setTimeout(() => codeRef.current?.focus(), 0); }
    } catch (err) { setAStatus({ problem: toProblem(err) }); }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeV.validate({ "c-code": code })) return;
    try {
      const r = await api<{ category: string; city: string }>("/v1/alerts/confirm", { body: { phone: pendingPhone, code: code.trim() } });
      setCStatus({ text: `Alerts are on: ${categoryLabel(r.category)} jobs in ${r.city === "any" ? "any city" : r.city}. Reply STOP to any alert to end them.` });
    } catch (err) { setCStatus({ problem: toProblem(err) }); }
  };

  const submitStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopV.validate({ "s-phone": sPhone })) return;
    try {
      const r = await api<{ stopped: number }>("/v1/alerts/unsubscribe", { body: { channel: "sms", address: sPhone.trim() } });
      setSStatus({ text: r.stopped ? "Alerts stopped." : "There were no alerts for that number. Nothing to stop." });
    } catch (err) { setSStatus({ problem: toProblem(err) }); }
  };

  /* ───────── Accommodation dialog ───────── */
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [accJob, setAccJob] = useState<Job | null>(null);
  const [step, setStep] = useState(1);
  const [stepTick, setStepTick] = useState(0);
  const [adj, setAdj] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [accErr, setAccErr] = useState<Problem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [amNote, setAmNote] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [announce, setAnnounce] = useState("");
  const errRef = useRef<HTMLDivElement>(null);

  const goStep = (n: number) => { setStep(n); setStepTick((t) => t + 1); };
  useEffect(() => { if (stepTick) document.getElementById(`acc-h${step}`)?.focus(); }, [step, stepTick]);

  const openAcc = (job: Job, btn: HTMLButtonElement) => {
    setAccJob(job); opener.current = btn; setDraft(null); setAccErr(null); setAdj([]); setOther("");
    const d = dlg.current;
    if (d && typeof d.showModal === "function") d.showModal(); else d?.setAttribute("open", "");
    goStep(1);
  };
  const closeAcc = () => { const d = dlg.current; if (d?.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); } };
  useEffect(() => {
    const d = dlg.current;
    const onClose = () => opener.current?.focus();
    d?.addEventListener("close", onClose);
    return () => d?.removeEventListener("close", onClose);
  }, []);

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adj.length && !other.trim()) {
      setAccErr({ message: "choose at least one thing that would help, or write it in Other." });
      setTimeout(() => errRef.current?.focus(), 0);
      return;
    }
    setAccErr(null);
    const l = lang();
    try {
      const d = await api<Draft>("/v1/accommodation/draft", { body: { job_id: accJob?.id, adjustments: adj, other: other.trim() || null, lang: l } });
      setDraft(d);
      setText(l === "am" && d.text_am ? d.text_am : d.text_en);
      setAmNote(l === "am" && !d.text_am && d.am_note ? d.am_note : null);
      goStep(2);
    } catch (err) { setAccErr(toProblem(err)); setTimeout(() => errRef.current?.focus(), 0); }
  };

  const to = draft?.contact_hint && draft.contact_hint.indexOf("@") > 0 ? draft.contact_hint : "";
  const subject = draft?.subject_en ?? "Interview arrangements";
  const mailHref = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const smsHref = `sms:?body=${encodeURIComponent(text)}`;
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setAnnounce("Message copied."); setCopyLabel("Copied"); setTimeout(() => setCopyLabel("Copy"), 2000);
    } catch { setAnnounce("Copy did not work. Go back and select the text."); }
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <>
      <form id="filters" className={`card ${s.filters}`} aria-label="Filter jobs" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="f-category">Job type</label>
          <select id="f-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any job type</option>
            {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-city">City</label>
          <select id="f-city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Any city</option>
            {meta.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <details id="f-supports-details" className={s.supports}>
            <summary id="f-supports-summary">{supports.length ? `Support I need (${supports.length} chosen)` : "Support I need"}</summary>
            <fieldset className="checks" aria-labelledby="f-supports-summary" id="f-supports">
              {meta.supports.map((x) => (
                <label key={x.id} className="check">
                  <input type="checkbox" name="f-sup" value={x.id} checked={supports.includes(x.id)} onChange={() => setSupports((l) => toggle(l, x.id))} /> {x.label}
                </label>
              ))}
            </fieldset>
          </details>
        </div>
        <button type="button" id="clear" className="btn btn-quiet" onClick={clearFilters}>Clear filters</button>
      </form>

      <p id="showing" role="status" aria-live="polite" className="status">{showing}</p>

      <div className={s.layout}>
        <section className={`card card-dark on-dark ${s.alerts}`} aria-labelledby="alerts-title">
          <h2 id="alerts-title" ref={alertsTitleRef}>Get alerts when a new job matches</h2>
          <p>By Telegram or SMS. Every alert tells you how to stop.</p>
          <button type="button" className="btn btn-secondary" id="open-alerts" aria-expanded={alertsOpen} aria-controls="alerts-form"
            onClick={() => (alertsOpen ? setAlertsOpen(false) : openAlerts())}>Get alerts</button>

          <form id="alerts-form" hidden={!alertsOpen} noValidate onSubmit={submitAlerts} style={{ marginBlockStart: "var(--space-5)" }}>
            {alertV.Summary()}
            <div className="field">
              <label htmlFor="a-category">Job type</label>
              <select id="a-category" ref={aCategoryRef} className="input" value={aCategory} onChange={(e) => setACategory(e.target.value)}>
                <option value="any">Any job type</option>
                {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="a-city">City</label>
              <select id="a-city" className="input" value={aCity} onChange={(e) => setACity(e.target.value)}>
                <option value="any">Any city</option>
                {meta.cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <fieldset className="field" id="a-supports">
              <legend>Support I need (optional)</legend>
              <div className="checks">
                {meta.supports.map((x) => (
                  <label key={x.id} className="check">
                    <input type="checkbox" name="a-sup" value={x.id} checked={aSupports.includes(x.id)} onChange={() => setASupports((l) => toggle(l, x.id))} /> {x.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>How should we send alerts?</legend>
              <label className="check"><input type="radio" name="a-channel" value="telegram" checked={channel === "telegram"} onChange={() => setChannel("telegram")} /> Telegram</label>
              <label className="check"><input type="radio" name="a-channel" value="sms" checked={channel === "sms"} onChange={() => setChannel("sms")} /> SMS</label>
            </fieldset>
            <div className={`field${alertV.errors["a-phone"] ? " field-error" : ""}`} id="a-phone-field" hidden={channel !== "sms"}>
              <label htmlFor="a-phone">Phone number (required for SMS)</label>
              <span className="hint" id="a-phone-hint">09… or 07… or +251…</span>
              <input {...alertV.fieldProps("a-phone", "a-phone-hint")} className="input" type="tel" inputMode="tel" autoComplete="tel"
                value={aPhone} onChange={(e) => setAPhone(e.target.value)} onBlur={(e) => alertV.blur("a-phone", e.target.value)} />
              {alertV.Err({ id: "a-phone" })}
            </div>
            <p>We keep your choice and your number or chat only until you stop alerts. We never label it.</p>
            <button type="submit" className="btn btn-primary">Start alerts</button>
            <StatusBox id="a-status" problem={aStatus?.problem}>
              {aStatus?.text ? <p>{aStatus.text}</p> : null}
              {aStatus?.link ? (
                <a href={aStatus.link} className="btn btn-secondary" target="_blank" rel="noopener">
                  Open the Telegram bot<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              ) : null}
            </StatusBox>
          </form>

          <form id="confirm-form" hidden={!pendingPhone} noValidate onSubmit={submitCode} style={{ marginBlockStart: "var(--space-5)" }}>
            {codeV.Summary()}
            <div className={`field${codeV.errors["c-code"] ? " field-error" : ""}`}>
              <label htmlFor="c-code">Code from the SMS</label>
              <span className="hint" id="c-code-hint">6 digits</span>
              <input {...codeV.fieldProps("c-code", "c-code-hint")} ref={codeRef} className="input" inputMode="numeric" autoComplete="one-time-code"
                value={code} onChange={(e) => setCode(e.target.value)} onBlur={(e) => codeV.blur("c-code", e.target.value)} />
              {codeV.Err({ id: "c-code" })}
            </div>
            <button type="submit" className="btn btn-secondary">Confirm alerts</button>
            <StatusBox id="c-status" problem={cStatus?.problem}>{cStatus?.text}</StatusBox>
          </form>

          <details className={s.stopBox}>
            <summary>Stop alerts</summary>
            <form id="stop-form" noValidate onSubmit={submitStop}>
              {stopV.Summary()}
              <div className={`field${stopV.errors["s-phone"] ? " field-error" : ""}`}>
                <label htmlFor="s-phone">Phone number you get SMS alerts on</label>
                <span className="hint" id="s-phone-hint">09… or 07… or +251…. On Telegram, send /stop to the bot instead.</span>
                <input {...stopV.fieldProps("s-phone", "s-phone-hint")} className="input" type="tel" inputMode="tel" autoComplete="tel"
                  value={sPhone} onChange={(e) => setSPhone(e.target.value)} onBlur={(e) => stopV.blur("s-phone", e.target.value)} />
                {stopV.Err({ id: "s-phone" })}
              </div>
              <button type="submit" className="btn btn-secondary">Stop my SMS alerts</button>
              <StatusBox id="s-status" problem={sStatus?.problem}>{sStatus?.text}</StatusBox>
            </form>
          </details>
        </section>

        <section aria-labelledby="results-title">
          <h2 id="results-title" className="highlight" style={{ marginBlockEnd: "var(--space-5)" }}>Jobs</h2>
          <StatusBox id="results-error" problem={resultsError} role="alert" />
          <ul id="results" className={s.list}>
            {(jobs ?? []).map((j) => (
              <li key={j.id}>
                <article className={`card ${s.job}`} aria-labelledby={`job-${j.id}`}>
                  <h3 id={`job-${j.id}`}>{j.title}</h3>
                  <p className={s.meta}>{j.employer} · {j.city} <span className="badge">Sample job</span></p>
                  <p>{j.summary_simple}</p>
                  {j.deadline ? (
                    <p>
                      Apply by {new Date(j.deadline + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      {j.deadline_ethiopian ? ` (Ethiopian calendar: ${j.deadline_ethiopian.label_en})` : ""}.
                    </p>
                  ) : null}
                  <p>
                    {j.supports_labels.length
                      ? `Support offered: ${sentenceList(j.supports_labels.map(lowerFirst))}.`
                      : "No support is listed for this job yet. You can still ask."}
                  </p>
                  <div className="actions">
                    <a className="btn btn-primary" href={j.apply_url || "#"} target="_blank" rel="noopener">
                      Apply<span className="visually-hidden"> for {j.title} (opens in a new tab)</span>
                    </a>
                    <button type="button" className="btn btn-secondary" onClick={(e) => openAcc(j, e.currentTarget)}>
                      Ask for support<span className="visually-hidden"> for {j.title}</span>
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <div id="empty" className="card" hidden={!jobs || jobs.length > 0}>
            <p>No jobs match. Remove one support to see more, or get an alert when one is posted.</p>
            <div className="actions">
              <button type="button" className="btn btn-secondary" id="empty-clear" onClick={clearFilters}>Clear filters</button>
              <button type="button" className="btn btn-secondary" id="empty-alerts" onClick={openAlerts}>Get alerts</button>
            </div>
          </div>
        </section>
      </div>

      <dialog id="acc" aria-labelledby={`acc-h${step}`} ref={dlg}
        onClick={(e) => { if ((e.target as HTMLElement).hasAttribute("data-close")) closeAcc(); }}>
        <div className={s.dialogBody}>
          <div id="acc-step1" hidden={step !== 1}>
            <p className={s.stepLabel}>Step 1 of 3</p>
            <h2 id="acc-h1" tabIndex={-1}>What would help at the interview?</h2>
            <p id="acc-job">{accJob ? `For the interview: ${accJob.title}, ${accJob.employer}.` : ""}</p>
            <form id="acc-form1" noValidate onSubmit={submitStep1}>
              <fieldset id="acc-adj" className="field">
                <legend>Choose all that help. We do not ask why.</legend>
                <div className="checks">
                  {ADJUSTMENTS.map((a) => (
                    <label key={a.id} className="check">
                      <input type="checkbox" value={a.id} checked={adj.includes(a.id)} onChange={() => setAdj((l) => toggle(l, a.id))} /> {a.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="acc-other">Other (optional)</label>
                <input id="acc-other" className="input" maxLength={300} value={other} onChange={(e) => setOther(e.target.value)} />
              </div>
              <div id="acc-err1" className={s.status} role="alert" tabIndex={-1} ref={errRef}>
                {accErr ? (<><p className={s.problem}>Problem: {accErr.message}</p>{accErr.fix ? <p>{accErr.fix}</p> : null}</>) : null}
              </div>
              <div className="actions">
                <button type="submit" className="btn btn-primary">Write my message</button>
                <button type="button" className="btn btn-quiet" data-close="">Cancel</button>
              </div>
            </form>
          </div>

          <div id="acc-step2" hidden={step !== 2}>
            <p className={s.stepLabel}>Step 2 of 3</p>
            <h2 id="acc-h2" tabIndex={-1}>Check your message</h2>
            {amNote ? <p id="acc-am-note">{amNote}</p> : null}
            <div className="field">
              <label htmlFor="acc-text">Your message. You can change any word.</label>
              <textarea id="acc-text" className="input" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="actions">
              <button type="button" className="btn btn-primary" id="acc-next" onClick={() => goStep(3)}>Next: choose how to send</button>
              <button type="button" className="btn btn-quiet" id="acc-back" onClick={() => goStep(1)}>Back</button>
            </div>
          </div>

          <div id="acc-step3" hidden={step !== 3}>
            <p className={s.stepLabel}>Step 3 of 3</p>
            <h2 id="acc-h3" tabIndex={-1}>Send it</h2>
            <p id="acc-to">
              {draft?.contact_hint ? `The employer's contact: ${draft.contact_hint}.` : "This job has no contact listed. Copy the message and send it where you applied."}
            </p>
            <div className="actions">
              <button type="button" className="btn btn-secondary" id="acc-copy" onClick={copy}>{copyLabel}</button>
              <a className="btn btn-secondary" id="acc-mail" href={mailHref}>Email app</a>
              <a className="btn btn-secondary" id="acc-sms" href={smsHref}>Text message app</a>
              <a className="btn btn-secondary" id="acc-tg" href={tgHref} target="_blank" rel="noopener">
                Telegram<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </div>
            <p>Your message is ready. Nothing was sent until you pressed one of those buttons.</p>
            <div className="actions">
              <button type="button" className="btn btn-quiet" id="acc-back2" onClick={() => goStep(2)}>Back</button>
              <button type="button" className="btn btn-quiet" data-close="">Close</button>
            </div>
          </div>
          <span className="visually-hidden" role="status">{announce}</span>
        </div>
      </dialog>

      <div className="cta-bar">
        <button type="button" className="btn btn-primary" id="cta-alerts" onClick={openAlerts}>Get alerts</button>
      </div>
    </>
  );
}

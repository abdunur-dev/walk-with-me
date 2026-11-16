"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./Art";
import LocaleSwitcher from "./LocaleSwitcher";
import { applyPrefs, getPref, setPref } from "@/lib/prefs";
import { DEFAULT_LOCALE, normalizeLocale, t as tf } from "@/lib/i18n";

// `labelKey` is a dotted path into src/locales/*.json, resolved at render time.
const NAV = [
  { href: "/", labelKey: "ui.navTryIt" },
  { href: "/docs", labelKey: "ui.navInstall" },
  { href: "/jobs", labelKey: "ui.navJobs" },
  { href: "/speech", labelKey: "ui.navSpeech" },
  { href: "/docs#api", labelKey: "ui.navDocs" },
];

const TOGGLES = [
  { key: "wwm.large", on: "1", off: "0", labelKey: "ui.largerText" },
  { key: "wwm.contrast", on: "1", off: "0", labelKey: "ui.highContrast" },
  { key: "wwm.motion", on: "off", off: "on", labelKey: "ui.stopMotion" },
];

function DisplayOptions() {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const read = () => {
      setState(Object.fromEntries(TOGGLES.map((t) => [t.key, getPref(t.key) === t.on])));
      setLang(normalizeLocale(getPref("wwm.lang")));
      applyPrefs();
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("wwm:settings", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("wwm:settings", read); };
  }, []);

  const flip = (t: (typeof TOGGLES)[number]) => {
    setPref(t.key, state[t.key] ? t.off : t.on);
    window.dispatchEvent(new CustomEvent("wwm:settings"));
  };

  const optionsLabel = tf(lang, "ui.displayOptions");

  return (
    <details className="display-options">
      <summary>{optionsLabel}</summary>
      <div className="options" role="group" aria-label={optionsLabel}>
        {TOGGLES.map((t) => (
          <button key={t.key} type="button" className="toggle" aria-pressed={!!state[t.key]} onClick={() => flip(t)}>
            {tf(lang, t.labelKey)}
          </button>
        ))}
        <LocaleSwitcher />
      </div>
    </details>
  );
}

export function SiteHeader() {
  const path = usePathname();
  // Nav labels follow the saved helper language. Starts as English on the server,
  // then matches localStorage after mount (no hydration mismatch).
  const [lang, setLang] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const read = () => setLang(normalizeLocale(getPref("wwm.lang")));
    read();
    window.addEventListener("storage", read);
    window.addEventListener("wwm:settings", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("wwm:settings", read); };
  }, []);

  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="logo">
          <LogoMark /> Walk With Me
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.labelKey}>
                <Link href={n.href} aria-current={path === n.href ? "page" : undefined}>
                  {tf(lang, n.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/docs" className="btn btn-secondary btn-small header-cta">
          {tf(lang, "ui.installTheHelper")}
        </Link>
        <DisplayOptions />
      </div>
    </header>
  );
}

export function SiteFooter() {
  const [lang, setLang] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const read = () => setLang(normalizeLocale(getPref("wwm.lang")));
    read();
    window.addEventListener("storage", read);
    window.addEventListener("wwm:settings", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("wwm:settings", read); };
  }, []);

  return (
    <footer className="site-footer on-dark">
      <div className="wrap footer-grid">
        <div>
          <p className="logo" style={{ color: "var(--card-dark-text)" }}><LogoMark /> Walk With Me</p>
          <p>A help widget for Savanna pages. Built for the Digital Bridge Accessibility Hackathon 2026, Track 3.</p>
          {/* Licence line to be confirmed with the organisers (ALX). */}
          <p>Licence: to be confirmed.</p>
        </div>
        <div>
          <h2>{tf(lang, "ui.footerPages")}</h2>
          <ul>
            <li><a href="/savanna/pages/concept-with-navigation.html">{tf(lang, "ui.savannaDemo")}</a></li>
            <li><Link href="/docs">{tf(lang, "ui.installDocs")}</Link></li>
            <li><Link href="/jobs">{tf(lang, "ui.navJobs")}</Link></li>
            <li><Link href="/sms-sim">{tf(lang, "ui.smsSimulator")}</Link></li>
            <li><Link href="/staff">{tf(lang, "ui.staffConsole")}</Link></li>
            <li><Link href="/teacher">{tf(lang, "ui.teacherView")}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{tf(lang, "ui.footerPrivacy")}</h2>
          <p>No names, no emails, no accounts. Chat text is deleted after 7 days. A call-back number is deleted when the request ends. Accommodation messages are never stored.</p>
          <p>To delete your data now, use <Link href="/docs#privacy">the deletion steps</Link>.</p>
        </div>
      </div>
    </footer>
  );
}

export function CtaBar({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  return (
    <div className="cta-bar">
      {external ? <a className="btn btn-primary" href={href}>{label}</a> : <Link className="btn btn-primary" href={href}>{label}</Link>}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-small copy"
        onClick={async () => {
          try { await navigator.clipboard.writeText(text); setMsg("Copied."); }
          catch { setMsg("Copy did not work. Select the text and copy it."); }
        }}
      >
        {label}
      </button>
      <span className="visually-hidden" role="status">{msg}</span>
    </>
  );
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="code">
      <pre tabIndex={0} aria-label={label}><code>{code}</code></pre>
      <CopyButton text={code} />
    </div>
  );
}

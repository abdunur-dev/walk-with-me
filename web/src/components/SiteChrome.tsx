"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./Art";
import { applyPrefs, getPref, setPref } from "@/lib/prefs";

const NAV = [
  { href: "/", label: "Try it" },
  { href: "/docs", label: "Install" },
  { href: "/jobs", label: "Jobs" },
  { href: "/speech", label: "Voice translation" },
  { href: "/docs#api", label: "Docs" },
];

const TOGGLES = [
  { key: "wwm.large", on: "1", off: "0", label: "Larger text" },
  { key: "wwm.contrast", on: "1", off: "0", label: "High contrast" },
  { key: "wwm.motion", on: "off", off: "on", label: "Stop motion" },
];

function DisplayOptions() {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const read = () => {
      setState(Object.fromEntries(TOGGLES.map((t) => [t.key, getPref(t.key) === t.on])));
      setLang(getPref("wwm.lang") === "am" ? "am" : "en");
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

  return (
    <details className="display-options">
      <summary>Display options</summary>
      <div className="options" role="group" aria-label="Display options">
        {TOGGLES.map((t) => (
          <button key={t.key} type="button" className="toggle" aria-pressed={!!state[t.key]} onClick={() => flip(t)}>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="toggle"
          aria-pressed={lang === "am"}
          onClick={() => { setPref("wwm.lang", lang === "am" ? "en" : "am"); window.dispatchEvent(new CustomEvent("wwm:settings")); }}
        >
          Helper language: <span lang="am">አማርኛ</span>
        </button>
      </div>
    </details>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="logo">
          <LogoMark /> Walk With Me
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.label}>
                <Link href={n.href} aria-current={path === n.href ? "page" : undefined}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/docs" className="btn btn-secondary btn-small header-cta">Install the helper</Link>
        <DisplayOptions />
      </div>
    </header>
  );
}

export function SiteFooter() {
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
          <h2>Pages</h2>
          <ul>
            <li><a href="/savanna/pages/concept-with-navigation.html">Savanna demo</a></li>
            <li><Link href="/docs">Install docs</Link></li>
            <li><Link href="/jobs">Jobs</Link></li>
            <li><Link href="/sms-sim">SMS simulator</Link></li>
            <li><Link href="/staff">Staff console</Link></li>
            <li><Link href="/teacher">Teacher view</Link></li>
          </ul>
        </div>
        <div>
          <h2>Privacy</h2>
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

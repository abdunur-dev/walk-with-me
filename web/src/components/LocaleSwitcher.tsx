"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, normalizeLocale, t } from "@/lib/i18n";
import { getPref, setPref } from "@/lib/prefs";

/**
 * Language picker for the whole site chrome.
 *
 * - A native <select> so it works with every screen reader and keyboard.
 * - Each option is labelled in its own language (endonym), so someone who only
 *   reads Amharic can find Amharic without reading English first.
 * - Persists to the shared `wwm.lang` key and mirrors it onto <html lang> so
 *   screen readers switch pronunciation.
 */
export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const [code, setCode] = useState(DEFAULT_LOCALE);

  // Read the saved choice (and storage changes from other tabs) after mount,
  // so server and client markup agree on the first render.
  useEffect(() => {
    const read = () => {
      try {
        const saved = normalizeLocale(getPref("wwm.lang"));
        setCode(saved);
        const root = document.documentElement;
        root.setAttribute("lang", saved);
        root.setAttribute("dir", "ltr");
      } catch {
        /* storage blocked: keep default for this page */
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("wwm:settings", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("wwm:settings", read);
    };
  }, []);

  const change = (next: string) => {
    const normalized = normalizeLocale(next);
    setCode(normalized);
    setPref("wwm.lang", normalized);
    document.documentElement.setAttribute("lang", normalized);
    // Same event the display toggles use, so other components refresh too.
    window.dispatchEvent(new CustomEvent("wwm:settings"));
  };

  const label = t(code, "ui.chooseLanguage");

  return (
    <label className={compact ? "locale-switcher locale-switcher-compact" : "locale-switcher"}>
      <span className="visually-hidden">{label}</span>
      <select
        value={code}
        aria-label={label}
        onChange={(e) => change(e.target.value)}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.endonym}
          </option>
        ))}
      </select>
    </label>
  );
}

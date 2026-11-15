// Locale plumbing for the site chrome.
//
// Why static imports: Turbopack (Next 16) must be able to resolve every JSON
// file at build time, so `require("./" + code + ".json")` will not work.
// Every language is imported explicitly and registered in LOCALES below.
//
// Adding a language: drop `xx.json` next to the others, import it here and add
// it to LOCALES. `endonym` is the name shown in the switcher, in that language.

import en from "../locales/en.json";
import am from "../locales/am.json";
import om from "../locales/om.json";
import ti from "../locales/ti.json";
import so from "../locales/so.json";
import sw from "../locales/sw.json";
import rw from "../locales/rw.json";
import rn from "../locales/rn.json";
import lg from "../locales/lg.json";
import ki from "../locales/ki.json";
import sn from "../locales/sn.json";
import ny from "../locales/ny.json";
import zu from "../locales/zu.json";
import xh from "../locales/xh.json";
import st from "../locales/st.json";
import sg from "../locales/sg.json";
import wo from "../locales/wo.json";
import ha from "../locales/ha.json";
import yo from "../locales/yo.json";
import ig from "../locales/ig.json";
import ff from "../locales/ff.json";
import mg from "../locales/mg.json";

export const DEFAULT_LOCALE = "en";

type Bundle = Record<string, unknown>;

export type LocaleInfo = { code: string; endonym: string; bundle: Bundle };

export const LOCALES: LocaleInfo[] = [
  { code: "en", endonym: "English", bundle: en as Bundle },
  { code: "am", endonym: "አማርኛ", bundle: am as Bundle },
  { code: "om", endonym: "Afaan Oromoo", bundle: om as Bundle },
  { code: "ti", endonym: "ትግርኛ", bundle: ti as Bundle },
  { code: "so", endonym: "Soomaali", bundle: so as Bundle },
  { code: "sw", endonym: "Kiswahili", bundle: sw as Bundle },
  { code: "rw", endonym: "Ikinyarwanda", bundle: rw as Bundle },
  { code: "rn", endonym: "Ikirundi", bundle: rn as Bundle },
  { code: "lg", endonym: "Luganda", bundle: lg as Bundle },
  { code: "ki", endonym: "Gĩkũyũ", bundle: ki as Bundle },
  { code: "sn", endonym: "ChiShona", bundle: sn as Bundle },
  { code: "ny", endonym: "Chichewa", bundle: ny as Bundle },
  { code: "zu", endonym: "isiZulu", bundle: zu as Bundle },
  { code: "xh", endonym: "isiXhosa", bundle: xh as Bundle },
  { code: "st", endonym: "Sesotho", bundle: st as Bundle },
  { code: "sg", endonym: "Yângâ tî Sängö", bundle: sg as Bundle },
  { code: "wo", endonym: "Wolof", bundle: wo as Bundle },
  { code: "ha", endonym: "Hausa", bundle: ha as Bundle },
  { code: "yo", endonym: "Yorùbá", bundle: yo as Bundle },
  { code: "ig", endonym: "Igbo", bundle: ig as Bundle },
  { code: "ff", endonym: "Fulfulde", bundle: ff as Bundle },
  { code: "mg", endonym: "Malagasy", bundle: mg as Bundle },
];

const SUPPORTED = new Set(LOCALES.map((l) => l.code));
const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

/** Coerce anything (storage value, navigator.language, data-lang) to a supported code. */
export function normalizeLocale(input: string | null | undefined): string {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  if (SUPPORTED.has(lower)) return lower;
  const base = lower.split(/[-_]/)[0];
  return SUPPORTED.has(base) ? base : DEFAULT_LOCALE;
}

export function getLocaleInfo(code: string): LocaleInfo {
  return BY_CODE.get(normalizeLocale(code)) ?? (BY_CODE.get(DEFAULT_LOCALE) as LocaleInfo);
}

function dig(source: unknown, parts: string[]): unknown {
  return parts.reduce<unknown>(
    (node, part) => (node && typeof node === "object" ? (node as Bundle)[part] : undefined),
    source
  );
}

/**
 * Translate a dotted key, e.g. t("ui.displayOptions").
 * Falls back to English, then to the key itself, so a missing entry never
 * renders an empty label.
 */
export function t(code: string, key: string, params?: Record<string, string | number>): string {
  const info = getLocaleInfo(code);
  const parts = key.split(".");
  const raw = dig(info.bundle, parts) ?? dig(en as Bundle, parts);
  const value = typeof raw === "string" ? raw : key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

/** Suggested language from the browser, used only when the user has not chosen one. */
export function browserLocale(): string {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of list) {
    const code = normalizeLocale(candidate);
    if (code !== DEFAULT_LOCALE) return code;
  }
  return DEFAULT_LOCALE;
}

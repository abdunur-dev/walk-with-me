# Localization (i18n) — Walk With Me

Multi-language support for East African and wider African languages.

## What's here

| File | Purpose |
|------|---------|
| `locales/en.json` | **Base language (English).** Source of truth for the key tree. Edit strings here first. |
| `locales/<code>.json` | One file per language, same key structure as `en.json`. |
| `locales/index.json` | Language manifest (code, English name, endonym) for building a language switcher. |
| `i18n.json` (project root) | All languages bundled in one file: `{ "en": {...}, "am": {...}, ... }`. |
| `locales/_generate.js` + `_translations-*.js` | Build script and translation data. Regenerates every file. |

## Languages (22)

`en` English · `am` Amharic · `om` Afaan Oromo · `ti` Tigrinya · `so` Somali · `sw` Swahili ·
`rw` Kinyarwanda · `rn` Kirundi · `lg` Luganda · `ki` Kikuyu · `sn` Shona · `ny` Nyanja/Chichewa ·
`zu` Zulu · `xh` Xhosa · `st` Sesotho · `sg` Sango · `wo` Wolof · `ha` Hausa · `yo` Yoruba ·
`ig` Igbo · `ff` Fulfulde · `mg` Malagasy

Every file contains the same **129 keys**. Any key without a translation automatically falls back
to English, so the UI can never show a blank string.

## Regenerating

```bash
node locales/_generate.js
```

This rewrites `locales/*.json`, `i18n.json` and `locales/index.json`. To change wording, edit the
`T.<lang>` object in `locales/_generate.js` or the matching `_translations-N.js` file, then re-run.
An override key that is not in `en.json` makes the script fail loudly (typo protection).

## Using it

**i18next / react-i18next**
```js
i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: { en: { translation: require("./locales/en.json") }, am: { translation: require("./locales/am.json") } },
  lng: navigator.language.split("-")[0],
});
```

**Flutter** — copy `locales/<code>.json` into `assets/locales/`, then load with `rootBundle.loadString()`.

**Language switcher** — read `locales/index.json` and render the `endonym` for each option, so
Amharic shows as "አማርኛ" and Oromo as "Afaan Oromoo" rather than English names.

## ⚠️ Translation quality — please review before shipping

- **English** — written by hand, reliable.
- **Swahili, Somali, Hausa, Yoruba, Zulu, Xhosa, Amharic** — good working translations, still worth a native pass.
- **Tigrinya, Oromo, Kinyarwanda, Kirundi, Luganda, Kikuyu, Shona, Chichewa, Sesotho, Sango, Wolof, Igbo, Fulfulde, Malagasy** — best-effort machine-quality. Grammar, tone and some technical terms (e.g. "streak") may need correction.

Recommended before release: have one native speaker per language review `locales/<code>.json`.
Fastest workflow: hand a reviewer only the strings, not the JSON structure.

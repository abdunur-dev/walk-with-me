"""Search normalisation for Amharic and English text.

* Tokenise on whitespace and Ethiopic punctuation (፡ ። ፣ ፤ ፥ ፦ ፧ ፨).
* Fold homophone letter families onto one form so spelling variants match.
  Each family is 8 contiguous code points, so a family maps by offset:
      ሐ U+1210, ኀ U+1280  -> ሀ U+1200
      ሠ U+1220            -> ሰ U+1230
      ዐ U+12D0            -> አ U+12A0
      ፀ U+1340            -> ጸ U+1338
* Lowercase English, strip punctuation, light suffix stripping.

The same rules are mirrored in widget/walk-with-me.js (offline FAQ search); keep them in sync.
"""
from __future__ import annotations

import re

_FAMILIES = [(0x1210, 0x1200), (0x1280, 0x1200), (0x1220, 0x1230), (0x12D0, 0x12A0), (0x1340, 0x1338)]
_FOLD = {src + i: dst + i for src, dst in _FAMILIES for i in range(8)}

ETHIOPIC_PUNCT = "፡።፣፤፥፦፧፨"
_SPLIT = re.compile(rf"[\s{ETHIOPIC_PUNCT}]+")
_STRIP = re.compile(r"[^\wሀ-፿]+", re.UNICODE)
_ETHIOPIC = re.compile(r"[ሀ-፿]")

_PII = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), " "),        # emails
    (re.compile(r"\+?\d[\d\s-]{6,}\d"), " "),               # phone-like numbers
]

STOPWORDS_EN = set("""a an the and or of to in on for with by from at as is are was were be it its this that
i me my you your we our do does did can could will would should how what where which who why when there here
please tell about into than then so if not no yes""".split())


def fold(text: str) -> str:
    return "".join(chr(_FOLD.get(ord(ch), ord(ch))) for ch in text)


def _stem(tok: str) -> str:
    if _ETHIOPIC.search(tok) or len(tok) < 5:
        return tok
    for suf in ("ing", "ed", "es", "s"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 3:
            return tok[: -len(suf)]
    return tok


def tokens(text: str, drop_stopwords: bool = True) -> list[str]:
    out = []
    for raw in _SPLIT.split(fold(text or "").lower()):
        tok = _STRIP.sub("", raw).replace("_", "")
        if not tok:
            continue
        if drop_stopwords and tok in STOPWORDS_EN:
            continue
        out.append(_stem(tok))
    return out


def has_ethiopic(text: str) -> bool:
    return bool(_ETHIOPIC.search(text or ""))


def normalise_question(text: str) -> str:
    """Text stored in question_log: personal details removed, folded, lowercased, max 200 chars."""
    t = text or ""
    for pat, rep in _PII:
        t = pat.sub(rep, t)
    return " ".join(tokens(t, drop_stopwords=False))[:200]

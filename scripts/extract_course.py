"""Split a Savanna concept page into sections and write data/course.json.

Usage:
    python scripts/extract_course.py [path/to/page.html] [--inject]

Sections start at each <h2>. With --inject, headings that have no id get
id="wwm-sN" written back into the page (run it on a COPY of the starter page,
never the original). Amharic fields stay null until a native speaker writes them.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PAGE = ROOT / "savanna" / "pages" / "concept-with-navigation.html"
OUT = ROOT / "data" / "course.json"

STOP = set("""a an the and or but if of to in on for with by from at as is are was were be been being it its this that
these those you your we our they their he she his her them i me my not no do does did can could will would should
so than then there here what which who whom when where why how all any some more most other such only own same too
very just also into over under about after before up down out off again once each few both much many may might must
one two three five next used use uses usually often lets let keep make makes made get gets press below above""".split())


class Splitter(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_main = False
        self.depth_skip = 0
        self.cur_tag: str | None = None
        self.sections: list[dict] = []
        self.title = ""
        self._h1 = False
        self._h2: dict | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main":
            self.in_main = True
        if not self.in_main:
            return
        if tag in ("script", "style", "button", "nav"):
            self.depth_skip += 1
        if tag == "h1":
            self._h1 = True
        if tag == "h2":
            self._h2 = {"anchor": a.get("id"), "title": ""}

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = False
        if not self.in_main and tag != "main":
            return
        if tag in ("script", "style", "button", "nav") and self.depth_skip:
            self.depth_skip -= 1
        if tag == "h1":
            self._h1 = False
        if tag == "h2" and self._h2 is not None:
            self.sections.append({"anchor": self._h2["anchor"], "title_en": self._h2["title"].strip(), "body": []})
            self._h2 = None

    def handle_data(self, data):
        if not self.in_main or self.depth_skip:
            return
        if self._h1:
            self.title += data
        elif self._h2 is not None:
            self._h2["title"] += data
        elif self.sections:
            self.sections[-1]["body"].append(data)


def keywords(text: str, n: int = 8) -> list[str]:
    words = [w for w in re.findall(r"[a-z][a-z\-]+", text.lower()) if w not in STOP and len(w) > 2]
    return [w for w, _ in Counter(words).most_common(n)]


def main(argv: list[str]) -> None:
    page = Path(argv[1]) if len(argv) > 1 and not argv[1].startswith("--") else DEFAULT_PAGE
    inject = "--inject" in argv
    html = page.read_text(encoding="utf-8")

    if inject:
        counter = iter(range(1, 1000))
        html = re.sub(r"<h2(?![^>]*\sid=)", lambda m: f'<h2 id="wwm-s{next(counter)}"', html)
        page.write_text(html, encoding="utf-8")

    sp = Splitter()
    sp.feed(html)
    page_url = "/savanna/pages/" + page.name
    sections = []
    for i, s in enumerate(sp.sections, start=1):
        body = re.sub(r"\s+", " ", " ".join(s["body"])).strip()
        sections.append({
            "id": f"va-1.future.s{i}",
            "anchor": s["anchor"] or f"wwm-s{i}",
            "position": i,
            "title_en": s["title_en"],
            "body_en": body,
            "title_am": None,
            "body_am": None,
            "keywords_en": keywords(s["title_en"] + " " + s["title_en"] + " " + body),
            "keywords_am": [],
            "term_pairs": [],
            "verified_am": 0,
        })
    out = {
        "course_id": "VA-1",
        "concept_id": "future-of-the-va-industry",
        "concept_title": re.sub(r"\s+", " ", sp.title).strip(),
        "page_url": page_url,
        "sections": sections,
    }
    # Keep hand-added term pairs and Amharic text from a previous run.
    if OUT.exists():
        old = {s["anchor"]: s for s in json.loads(OUT.read_text(encoding="utf-8")).get("sections", [])}
        for s in sections:
            prev = old.get(s["anchor"])
            if prev:
                for k in ("title_am", "body_am", "keywords_am", "term_pairs", "verified_am"):
                    if prev.get(k):
                        s[k] = prev[k]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(sections)} sections to {OUT}")


if __name__ == "__main__":
    main(sys.argv)

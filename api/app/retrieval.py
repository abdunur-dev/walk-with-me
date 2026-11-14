"""BM25 retrieval over course sections, FAQ entries and (for job questions) jobs.

Ranking uses BM25. The threshold uses a separate, bounded score in [0, 1]: the share of the
question's information (IDF-weighted query terms) that the passage covers. Words that appear
nowhere in the course count against the score, so out-of-course questions fall below MIN_SCORE.
"""
from __future__ import annotations

import math
import threading
from collections import Counter
from dataclasses import dataclass, field

from . import db
from .normalise_am import fold, tokens

SUPPORT_LABELS = {
    "step_free": "Step-free entrance and lift",
    "screen_reader_software": "Screen reader software available",
    "sign_language_interpreter": "Sign language interpreter for interviews",
    "written_interview_questions": "Interview questions in writing",
    "extra_time": "Extra time for tests",
    "flexible_hours": "Flexible hours",
    "quiet_room": "Quiet room",
    "remote_option": "Work from home option",
    "large_print_materials": "Large print materials",
}
CATEGORIES = ["driver", "customer-support", "data-entry", "teaching-assistant", "sales", "admin", "virtual-assistant", "retail"]
CITIES = ["Addis Ababa", "Adama", "Hawassa", "Bahir Dar", "Mekelle", "Dire Dawa", "Gondar", "Jimma"]

_JOB_WORDS = set(tokens("job jobs vacancy vacancies hiring hire apply employer employers salary interview opening openings position "
                        "alert alerts accommodation") + tokens(" ".join(CITIES)) + tokens(" ".join(c.replace("-", " ") for c in CATEGORIES))
                 + [fold("ሥራ"), fold("ስራ")])
_JOB_WORDS -= set(tokens("assistant support customer data entry"))  # too common in the course itself


@dataclass
class Passage:
    id: str
    type: str                     # "section" | "faq" | "job"
    title: str
    text: str
    url: str
    section_id: str | None = None
    action_id: str | None = None
    answer_en: str | None = None
    answer_am: str | None = None
    term_pairs: list = field(default_factory=list)
    score: float = 0.0            # bounded coverage score used for MIN_SCORE
    bm25: float = 0.0


class Index:
    k1, b = 1.4, 0.75

    def __init__(self, docs: list[tuple[Passage, list[str]]]):
        self.docs = docs
        self.N = max(len(docs), 1)
        self.avgdl = sum(len(t) for _, t in docs) / self.N if docs else 1.0
        self.tf = [Counter(t) for _, t in docs]
        df: Counter = Counter()
        for _, t in docs:
            df.update(set(t))
        self.df = df

    def idf(self, term: str) -> float:
        n = self.df.get(term, 0)
        return math.log(1 + (self.N - n + 0.5) / (n + 0.5))

    def search(self, query_tokens: list[str], k: int = 4, types: set[str] | None = None) -> list[Passage]:
        if not query_tokens:
            return []
        q = list(dict.fromkeys(query_tokens))
        total_idf = sum(self.idf(t) for t in q) or 1.0
        results = []
        for (p, toks), tf in zip(self.docs, self.tf):
            if types and p.type not in types:
                continue
            dl = len(toks) or 1
            s, covered = 0.0, 0.0
            for t in q:
                f = tf.get(t, 0)
                if not f:
                    continue
                idf = self.idf(t)
                covered += idf
                s += idf * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
            if s > 0:
                if p.type == "faq":
                    s *= 1.15  # human-written answers win ties against raw section text
                results.append((s, covered / total_idf, p))
        results.sort(key=lambda r: r[0], reverse=True)
        out = []
        for s, cov, p in results[:k]:
            hit = Passage(**{**p.__dict__})
            hit.bm25, hit.score = round(s, 4), round(cov, 4)
            out.append(hit)
        return out


_lock = threading.Lock()
_index: Index | None = None


def _build() -> Index:
    docs: list[tuple[Passage, list[str]]] = []
    with db.tx() as c:
        sections = {r["id"]: r for r in c.execute("SELECT * FROM course_sections ORDER BY position")}
        for r in sections.values():
            p = Passage(id=r["id"], type="section", title=r["title_en"], text=r["body_en"],
                        url=f'{r["page_url"]}#{r["anchor"]}', section_id=r["id"],
                        term_pairs=db.jl(r["term_pairs"]))
            words = " ".join([r["title_en"]] * 2 + [r["body_en"], " ".join(db.jl(r["keywords_en"])),
                              " ".join(db.jl(r["keywords_am"])), r["title_am"] or "", r["body_am"] or ""])
            docs.append((p, tokens(words)))
        for r in c.execute("SELECT * FROM faq_entries"):
            sec = sections.get(r["section_id"]) if r["section_id"] else None
            url = f'{sec["page_url"]}#{sec["anchor"]}' if sec else ""
            p = Passage(id=r["id"], type="faq", title=sec["title_en"] if sec else r["question_en"], text=r["answer_en"],
                        url=url, section_id=r["section_id"], action_id=r["action_id"],
                        answer_en=r["answer_en"], answer_am=r["answer_am"])
            kw = " ".join(db.jl(r["keywords_en"]) * 2 + db.jl(r["keywords_am"]) * 2)
            words = " ".join([r["question_en"], r["question_am"] or "", r["answer_en"], kw])
            docs.append((p, tokens(words)))
        for r in c.execute("SELECT * FROM jobs WHERE active = 1"):
            sup = [SUPPORT_LABELS.get(s, s) for s in db.jl(r["supports"])]
            p = Passage(id=r["id"], type="job", title=f'{r["title"]}, {r["employer"]} ({r["city"]})',
                        text=f'{r["summary_simple"]} City: {r["city"]}. Deadline: {r["deadline"] or "none"}. '
                             f'Support offered: {", ".join(sup) or "none listed"}.',
                        url=r["apply_url"] or "/site/jobs.html")
            words = " ".join([r["title"], r["employer"], r["category"].replace("-", " "), r["city"], r["summary_simple"],
                              " ".join(sup), "job"])
            docs.append((p, tokens(words)))
    return Index(docs)


def index() -> Index:
    global _index
    with _lock:
        if _index is None:
            _index = _build()
        return _index


def rebuild() -> None:
    global _index
    with _lock:
        _index = _build()


def is_job_question(text: str) -> bool:
    return bool(set(tokens(text)) & _JOB_WORDS)


def retrieve(text: str, k: int = 4, include_jobs: bool | None = None) -> list[Passage]:
    qt = tokens(text)
    jobs = is_job_question(text) if include_jobs is None else include_jobs
    types = {"section", "faq", "job"} if jobs else {"section", "faq"}
    hits = index().search(qt, k=k, types=types)
    if jobs:
        # Make sure job passages are represented even when course text scores higher.
        job_hits = [h for h in index().search(qt, k=k, types={"job"}) if h.id not in {x.id for x in hits}]
        hits = (hits + job_hits)[: k + 2]
    return hits

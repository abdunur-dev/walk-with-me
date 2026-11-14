"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { TokenForm, errorText, readToken, saveToken, useAnnouncer } from "./ui";
import styles from "./console.module.css";

type Item = { question: string; section_id: string | null; section_title: string; count: number };
type Data = { k_min: number; days: number; items: Item[] };

export default function TeacherView() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loginError, setLoginError] = useState("");
  const [desc, setDesc] = useState(true);
  const focusResults = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { announce, region } = useAnnouncer();

  useEffect(() => { const t = readToken(); if (t) setToken(t); }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<Data>("/v1/teacher/top-questions", { token }).then(
      (d) => { if (!cancelled) { setData(d); setLoginError(""); } },
      (err) => { if (!cancelled) { saveToken(null); setToken(null); setData(null); setLoginError(errorText(err)); } },
    );
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (data && focusResults.current) { focusResults.current = false; titleRef.current?.focus(); }
  }, [data]);

  if (!data) {
    return (
      <>
        <TokenForm button="Show questions" error={loginError}
          onSubmit={(t) => { saveToken(t); focusResults.current = true; setLoginError(""); setToken(t); }} />
        {region}
      </>
    );
  }

  const items = [...data.items].sort((a, b) => (desc ? b.count - a.count : a.count - b.count));
  const empty = items.length === 0;

  const exportCsv = async () => {
    try {
      const r = await fetch(`${API_BASE}/v1/teacher/top-questions?format=csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("export failed");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "top-questions.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      announce("CSV file downloaded.");
    } catch {
      announce("The export did not work. Try again.");
    }
  };

  return (
    <section id="results" aria-labelledby="results-title">
      {region}
      <div className="section-head">
        <h2 id="results-title" className="highlight" ref={titleRef} tabIndex={-1}>Top questions</h2>
        <p id="summary" role="status" aria-live="polite">
          {empty ? "" : `${items.length} ${items.length === 1 ? "question" : "questions"} asked at least ${data.k_min} times in the last ${data.days} days.`}
        </p>
      </div>
      {empty ? (
        <div id="empty" className="card">
          <p id="empty-text">
            No questions yet. Questions appear here once they have been asked by at least {data.k_min} {data.k_min === 1 ? "learner." : "learners."}
          </p>
        </div>
      ) : (
        <>
          <div className="actions" style={{ marginBlockEnd: "var(--space-5)" }}>
            <button type="button" className="btn btn-secondary" id="csv" onClick={exportCsv}>Export CSV</button>
          </div>
          <div className="table-wrap" id="table-wrap">
            <table>
              <caption className="visually-hidden">Questions, course section and how many times each was asked</caption>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Section</th>
                  <th scope="col" className={styles.num} id="count-th" aria-sort={desc ? "descending" : "ascending"}>
                    <button type="button" className={styles.sortBtn} id="sort" onClick={() => setDesc((d) => !d)}>
                      Times asked <span aria-hidden="true">{desc ? "↓" : "↑"}</span>
                      <span className="visually-hidden">
                        {desc ? ", sorted most first. Press to sort fewest first." : ", sorted fewest first. Press to sort most first."}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody id="rows">
                {items.map((i) => (
                  <tr key={`${i.question}|${i.section_id}`}>
                    <td dir="auto">{i.question}</td>
                    <td>{i.section_title}</td>
                    <td className={styles.num}>{i.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

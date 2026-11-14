"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export const TOKEN_KEY = "wwm.staffToken";

export function readToken(): string | null {
  try { return window.sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function saveToken(t: string | null): void {
  try {
    if (t) window.sessionStorage.setItem(TOKEN_KEY, t);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked: token lasts for this page only */ }
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return `${err.message} ${err.fix}`.trim();
  return "Something went wrong. Try again.";
}

/** A polite live region for short announcements. */
export function useAnnouncer() {
  const [msg, setMsg] = useState("");
  const announce = useCallback((m: string) => {
    setMsg("");
    window.setTimeout(() => setMsg(m), 50);
  }, []);
  const region = <div className="visually-hidden" role="status" aria-live="polite">{msg}</div>;
  return { announce, region };
}

/** Error text shown under a field, linked by aria-describedby. */
export function FieldError({ id, text }: { id: string; text: string | null }) {
  if (!text) return null;
  return <p id={id} className="error-text"><span>Problem: {text}</span></p>;
}

/** Token login form shared by the staff console and teacher view. */
export function TokenForm({ button, error, onSubmit }: { button: string; error: string; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (fieldErr) summaryRef.current?.focus(); }, [fieldErr]);

  return (
    <form
      id="login"
      className="card"
      noValidate
      style={{ maxInlineSize: "36rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        const t = value.trim();
        if (!t) { setFieldErr("Enter the staff token."); return; }
        setFieldErr(null);
        onSubmit(t);
      }}
    >
      {fieldErr && (
        <div className="error-summary" tabIndex={-1} ref={summaryRef} role="alert">
          <h2>There is a problem</h2>
          <ul><li><a href="#token">{fieldErr}</a></li></ul>
        </div>
      )}
      <div className={`field${fieldErr ? " field-error" : ""}`}>
        <label htmlFor="token">Staff token</label>
        <span className="hint" id="token-hint">You can paste it. It stays in this browser tab only.</span>
        <input
          id="token"
          className="input"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if (fieldErr && value.trim()) setFieldErr(null); }}
          aria-describedby={fieldErr ? "token-hint token-err" : "token-hint"}
          aria-invalid={fieldErr ? true : undefined}
        />
        <FieldError id="token-err" text={fieldErr} />
      </div>
      <button type="submit" className="btn btn-primary">{button}</button>
      <div id="login-status" role="alert">{error && <p className="error-text"><span>{error}</span></p>}</div>
    </form>
  );
}

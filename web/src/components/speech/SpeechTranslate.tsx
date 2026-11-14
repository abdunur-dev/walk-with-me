"use client";

import { useRef, useState } from "react";
import { API_BASE, ApiError } from "@/lib/api";

type Result = { transcript: string; source_language: string; translation: string; target_language: string };
type Failure = { message: string; fix?: string };
const MAX_BYTES = 15 * 1024 * 1024;

export default function SpeechTranslate() {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState("");
  const outputRef = useRef<HTMLElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setResult(null);
    setNotice("");
    if (!file) {
      setFailure({ message: "Choose an audio file first.", fix: "Select a WAV, MP3, M4A, OGG, FLAC or WebM recording." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setFailure({ message: "This recording is larger than 15 MB.", fix: "Trim the recording or choose a smaller file." });
      return;
    }
    if (!consent) {
      setFailure({ message: "Consent is needed before audio can be processed.", fix: "Select the consent box to continue." });
      return;
    }

    setBusy(true);
    setNotice("Transcribing and translating. This may take a few minutes for the first request.");
    const form = new FormData();
    form.set("audio", file);
    form.set("consent", "true");
    form.set("target_language", "English");
    try {
      const response = await fetch(`${API_BASE}/v1/speech/translate`, { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const apiError = body?.error;
        throw new ApiError(response.status, apiError?.code ?? "http_error",
          apiError?.message ?? `The server answered ${response.status}.`, apiError?.fix ?? "Try again in a minute.");
      }
      const data = await response.json() as Result;
      setResult(data);
      setNotice("Translation is ready. The transcript and translation are shown below.");
      window.setTimeout(() => outputRef.current?.focus(), 0);
    } catch (error) {
      if (error instanceof ApiError) setFailure({ message: error.message, fix: error.fix });
      else setFailure({ message: "The server could not be reached.", fix: "Check your connection and try again." });
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel speech-panel" aria-labelledby="speech-form-title">
      <h2 id="speech-form-title">Choose a recording</h2>
      <p id="speech-file-hint" className="field hint">WAV, MP3, M4A, OGG, FLAC or WebM. Up to 15 MB and 2 minutes.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <div className="field">
          <label htmlFor="speech-file">Amharic audio file</label>
          <input
            className="input"
            id="speech-file"
            name="audio"
            type="file"
            accept=".wav,.mp3,.m4a,.mp4,.ogg,.flac,.webm"
            aria-describedby="speech-file-hint speech-error"
            onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setFailure(null); setResult(null); }}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label className="check" htmlFor="speech-consent">
            <input id="speech-consent" name="consent" type="checkbox" checked={consent}
              onChange={(event) => { setConsent(event.currentTarget.checked); setFailure(null); }} disabled={busy} />
            <span>I agree to process this audio to create a transcript and translation.</span>
          </label>
          <p className="hint">The uploaded audio is deleted after processing. If a hosted translation model is configured, the transcript is sent to that provider. Avoid recordings with sensitive personal information.</p>
        </div>
        {failure ? (
          <div id="speech-error" className="error-summary" role="alert" tabIndex={-1}>
            <h2>We could not translate this recording</h2>
            <p>{failure.message}</p>
            {failure.fix ? <p>{failure.fix}</p> : null}
          </div>
        ) : <span id="speech-error" className="visually-hidden" />}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Working…" : "Transcribe and translate"}
        </button>
      </form>
      <p className="visually-hidden" role="status" aria-live="polite">{notice}</p>
      {result ? (
        <section className="speech-result" aria-labelledby="speech-result-title" tabIndex={-1} ref={outputRef}>
          <h2 id="speech-result-title">Your results</h2>
          <div className="field">
            <h3>Amharic transcript</h3>
            <p lang="am" dir="auto">{result.transcript}</p>
          </div>
          <div className="field">
            <h3>English translation</h3>
            <p dir="auto">{result.translation}</p>
          </div>
        </section>
      ) : null}
    </section>
  );
}

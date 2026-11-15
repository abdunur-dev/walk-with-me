import type { Metadata } from "next";
import SpeechTranslate from "@/components/speech/SpeechTranslate";

export const metadata: Metadata = {
  title: "Translate Amharic audio",
  description: "Transcribe a short Amharic recording and translate it to English.",
};

export default function SpeechPage() {
  return (
    <main id="main" tabIndex={-1} className="wrap">
      <h1>Translate Amharic audio</h1>
      <p>Choose a short recording in Amharic. We will show the transcript and its English translation.</p>
      <SpeechTranslate />
    </main>
  );
}

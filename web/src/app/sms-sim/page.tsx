import type { Metadata } from "next";
import SmsSimulator from "@/components/console/SmsSimulator";

export const metadata: Metadata = {
  title: "SMS simulator",
  description: "Try the Walk With Me SMS commands. Simulator only: no real messages are sent.",
  alternates: { canonical: "/site/sms-sim" },
};

export default function SmsSimPage() {
  return (
    <main id="main" tabIndex={-1} className="wrap">
      <h1>SMS simulator</h1>
      <SmsSimulator />
    </main>
  );
}

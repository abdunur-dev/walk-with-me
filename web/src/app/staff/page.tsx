import type { Metadata } from "next";
import StaffConsole from "@/components/console/StaffConsole";

export const metadata: Metadata = {
  title: "Staff console",
  description: "Answer learners who asked for a person.",
  robots: { index: false },
  alternates: { canonical: "/site/staff" },
};

export default function StaffPage() {
  return (
    <main id="main" tabIndex={-1} className="wrap">
      <h1>Staff console</h1>
      <p>Requests from learners who pressed Talk to a person. Staff never get control of a learner&apos;s device. Call-back numbers are deleted when a request is resolved.</p>
      <StaffConsole />
    </main>
  );
}

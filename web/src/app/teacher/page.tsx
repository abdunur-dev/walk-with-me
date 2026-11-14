import type { Metadata } from "next";
import TeacherView from "@/components/console/TeacherView";

export const metadata: Metadata = {
  title: "Teacher view",
  description: "Questions learners ask most, without names.",
  robots: { index: false },
  alternates: { canonical: "/site/teacher" },
};

export default function TeacherPage() {
  return (
    <main id="main" tabIndex={-1} className="wrap">
      <h1>Questions learners ask most</h1>
      <p>From the last 7 days. No names, no session ids. A question shows only after several learners asked it. Questions are stored without any link to a learner and deleted after 90 days.</p>
      <TeacherView />
    </main>
  );
}

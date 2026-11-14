import type { Metadata } from "next";
import JobsClient from "@/components/jobs/JobsClient";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Find jobs that offer the support you need. Get alerts by Telegram or SMS. Ask for interview support.",
  openGraph: { title: "Jobs · Walk With Me", description: "Find jobs that offer the support you need. Tell no one why." },
};

export default function JobsPage() {
  return (
    <main id="main" tabIndex={-1} className="wrap">
      <h1>Jobs</h1>
      <p>Find jobs that offer the support you need. You never have to say why. These are sample jobs for the demo.</p>
      <JobsClient />
    </main>
  );
}

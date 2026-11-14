import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/console/console.module.css";

// Exported as 500.html; the API serves it when a page request fails on the server.
export const metadata: Metadata = { title: "Something went wrong", robots: { index: false } };

export default function ServerError() {
  return (
    <main id="main" tabIndex={-1} className={`wrap ${styles.errorPage}`}>
      <h1 className={styles.bigTitle}>Something went wrong on our side.</h1>
      <p className="lead">It is not something you did. Try again in a minute, go to Home, or open the Savanna demo.</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/">Home</Link>
        <a className="btn btn-secondary" href="/savanna/pages/concept-with-navigation.html">Open the Savanna demo</a>
      </div>
    </main>
  );
}

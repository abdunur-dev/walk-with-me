import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/console/console.module.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className={`wrap ${styles.errorPage}`}>
      <h1 className={styles.bigTitle}>This page does not exist.</h1>
      <p className="lead">The link may be old. Go to Home, or open the Savanna demo.</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/">Home</Link>
        <a className="btn btn-secondary" href="/savanna/pages/concept-with-navigation.html">Open the Savanna demo</a>
      </div>
    </main>
  );
}

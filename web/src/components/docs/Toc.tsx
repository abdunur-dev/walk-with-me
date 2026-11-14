"use client";

import { useEffect, useRef } from "react";

const ITEMS = [
  ["install", "Install in one line"],
  ["api", "REST API"],
  ["jsonld", "Jobs as schema.org data"],
  ["show-me", "Show me where"],
  ["human-help", "Talk to a person"],
  ["answers", "Answers and languages"],
  ["channels", "Telegram and SMS"],
  ["ai", "Choosing the AI provider"],
  ["docker", "Run with Docker Compose"],
  ["privacy", "Privacy and deletion"],
  ["a11y", "Accessibility statement"],
];

/** Table of contents: open on wide screens, collapsed to a disclosure on phones. */
export default function Toc({ className }: { className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(max-width: 959px)").matches) ref.current.open = false;
  }, []);
  return (
    <nav className={className} aria-label="On this page">
      <details id="toc-details" open ref={ref}>
        <summary>On this page</summary>
        <ol>
          {ITEMS.map(([id, label]) => (
            <li key={id}><a href={`#${id}`}>{label}</a></li>
          ))}
        </ol>
      </details>
    </nav>
  );
}

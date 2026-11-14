import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Noto_Sans_Ethiopic, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { API_BASE } from "@/lib/api";
import { PREFS_BOOT } from "@/lib/prefs";

// next/font downloads these at build time and serves them from this site: no font CDN at runtime.
const head = Space_Grotesk({ subsets: ["latin"], weight: ["700"], variable: "--nf-head", display: "swap" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--nf-body", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--nf-mono", display: "swap" });
const ethiopic = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], weight: ["400", "700"], variable: "--nf-ethiopic", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:8000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Walk With Me: help on every Savanna page", template: "%s · Walk With Me" },
  description: "Ask in Amharic or English. Get an answer from the course, see where it came from, and reach a person with one button.",
  openGraph: {
    type: "website",
    title: "Walk With Me",
    description: "Ask in Amharic or English. Focus lands on the button. A person is one press away.",
    images: [{ url: "/site/og-image.png", width: 1200, height: 630, alt: "Walk With Me" }],
  },
  icons: { icon: "/site/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#352E72", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${mono.variable} ${ethiopic.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
        {/* The one line a platform adds. data-api empty = same origin as this site. */}
        <script src={`${API_BASE}/widget/walk-with-me.js`} data-api={API_BASE} data-lang="en" defer />
      </body>
    </html>
  );
}

import Link from "next/link";
import { AmharicArt, ArrowUpRight, HelperArt, JobsArt, ShareArt, ShowMeArt, Sparkle } from "@/components/Art";
import { CodeBlock, CtaBar } from "@/components/SiteChrome";
import { SAVANNA_DEMO } from "@/lib/api";

const INSTALL = `<script src="https://YOUR-HOST/widget/walk-with-me.js"
        data-api="https://YOUR-HOST" data-lang="am" defer></script>`;

const FEATURES = [
  {
    title: "Show me where",
    text: "Ask where the button is. The helper scrolls to it, moves your focus there and reads its name. You press it, not the helper.",
    href: "/docs#show-me", art: <ShowMeArt />, dark: false,
  },
  {
    title: "Share my place",
    text: "A helper sees where you are, not your whole screen. You read the place message first, change it, then send it.",
    href: "/docs#human-help", art: <ShareArt />, dark: true,
  },
  {
    title: "Answers in Amharic",
    text: "Answers come from the course only, with the English term your course uses beside the Amharic, and a link to the section.",
    href: "/docs#answers", art: <AmharicArt />, dark: true,
  },
  {
    title: "Translate a voice note",
    text: "Choose a short Amharic recording and read the transcript and English translation. You choose before any audio is processed.",
    href: "/speech", art: <AmharicArt />, dark: false,
  },
  {
    title: "Jobs and support",
    text: "Find jobs that offer the support you need. Tell no one why. Get alerts on Telegram or SMS, and write an interview request.",
    href: "/jobs", art: <JobsArt />, dark: false,
  },
];

const LEVELS = [
  { title: "Level 1: one script tag", text: "Paste one line on any page. The launcher appears in the same place on every page. Works on 3G and with no internet.", href: "/docs#install" },
  { title: "Level 2: REST API", text: "Every feature is an endpoint with an OpenAPI document: chat, human help, jobs, alerts and the teacher view.", href: "/docs#api" },
  { title: "Level 3: open data", text: "Jobs come out as schema.org JobPosting, so other job boards and search engines can read them.", href: "/docs#jsonld" },
];

export default function Home() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="wrap hero" aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title">Lost on a Savanna page? Ask. Focus lands on the button.</h1>
            <p className="lead">
              Walk With Me answers from the course in Amharic or English, shows where the answer is, and brings in a person when it cannot.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={SAVANNA_DEMO}>Try it on a Savanna page</a>
              <Link className="btn btn-secondary" href="/docs#install">Get the install line</Link>
            </div>
          </div>
          <div className="hero-demo">
            <Sparkle className="deco" size={34} style={{ insetInlineStart: -6, insetBlockStart: 8 }} />
            <Sparkle className="deco" size={22} fill="var(--lime)" style={{ insetInlineEnd: -4, insetBlockStart: -6 }} />
            <Sparkle className="deco" size={26} style={{ insetInlineEnd: 10, insetBlockEnd: -8 }} />
            <div className="frame">
              <div className="frame-bar" aria-hidden="true"><i /><i /><i /> Savanna demo</div>
              <iframe
                src={SAVANNA_DEMO}
                title="Savanna demo page with the working Walk With Me helper. Press Help inside it to try."
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="wrap" aria-label="Where it works">
          <ul className="strip">
            <li>Savanna pages</li>
            <li>Any website</li>
            <li>Telegram</li>
            <li>SMS</li>
            <li>No internet</li>
            <li lang="am">አማርኛ</li>
          </ul>
        </section>

        <section className="wrap section" aria-labelledby="features-title">
          <div className="section-head">
            <h2 id="features-title" className="highlight">What it does</h2>
            <p>Four things a learner needs when a page is hard to use: find the control, show a person where they are, read the answer in their language, and find work.</p>
          </div>
          <ul className="features">
            {FEATURES.map((f) => (
              <li key={f.title} className={`card feature${f.dark ? " card-dark on-dark" : ""}`}>
                <div>
                  <h3><span>{f.title}</span></h3>
                  <p>{f.text}</p>
                  <Link className="more" href={f.href}>
                    <span className="arrow"><ArrowUpRight /></span>
                    <span>Learn more<span className="visually-hidden"> about {f.title}</span></span>
                  </Link>
                </div>
                {f.art}
              </li>
            ))}
          </ul>
        </section>

        <section className="wrap section" aria-labelledby="cta-title">
          <div className="panel cta">
            <div>
              <h2 id="cta-title">No internet? It still answers.</h2>
              <p>The helper carries human-written answers from the course. When the network or the server is down, it answers from those and says so. Help from a person and job alerts need a connection, and the helper tells you that too.</p>
              <div className="actions">
                <a className="btn btn-dark" href={SAVANNA_DEMO}>Open the Savanna demo</a>
              </div>
            </div>
            <HelperArt />
          </div>
        </section>

        <section className="wrap section" aria-labelledby="install-title">
          <div className="section-head">
            <h2 id="install-title" className="highlight">Install</h2>
            <p>One line to add it to your site. Then go further with the API and open job data.</p>
          </div>
          <div className="band on-dark">
            <div style={{ marginBlockEnd: "var(--space-6)" }}>
              <CodeBlock code={INSTALL} label="Install line" />
            </div>
            <ul className="band-cols">
              {LEVELS.map((l) => (
                <li key={l.title}>
                  <h3>{l.title}</h3>
                  <p>{l.text}</p>
                  <Link className="more" href={l.href}>
                    <span>Learn more<span className="visually-hidden"> about {l.title}</span></span>
                    <ArrowUpRight />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="actions">
              <Link className="btn btn-primary" href="/docs">Read the install docs</Link>
            </div>
          </div>
        </section>

        {/* "Tested with co-designers" stays hidden until real test results exist (docs/testing-notes.md). */}
      </main>
      <CtaBar href={SAVANNA_DEMO} label="Try it on Savanna" external />
    </>
  );
}

// Line illustrations in the template's style: 2px indigo strokes, lime fills, sparkles and orbits.
// All decorative (aria-hidden); the text next to each one carries the meaning.

const S = { fill: "none", stroke: "var(--indigo)", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Sparkle({ size = 28, fill = "var(--indigo)", className, style }: { size?: number; fill?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <path d="M12 0c.8 6.4 4.8 10.6 12 12-7.2 1.4-11.2 5.6-12 12-.8-6.4-4.8-10.6-12-12C7.2 10.6 11.2 6.4 12 0z" fill={fill} />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 28 28">
      <rect x="2" y="2" width="24" height="24" rx="7" fill="var(--lime)" stroke="var(--indigo)" strokeWidth="2.5" />
      <path d="M8 10l3 9 3-6 3 6 3-9" {...S} />
    </svg>
  );
}

export function ArrowUpRight({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 16 16">
      <path d="M4 12L12 4M6 4h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Show me: a button wearing the focus ring and its label badge, with a cursor arrow. */
export function ShowMeArt() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 140">
      <ellipse cx="80" cy="76" rx="74" ry="26" {...S} strokeDasharray="4 6" />
      <rect x="30" y="54" width="100" height="40" rx="10" {...S} fill="var(--white)" />
      <rect x="22" y="46" width="116" height="56" rx="16" fill="none" stroke="var(--blue)" strokeWidth="4" />
      <path d="M48 74h64" {...S} />
      <rect x="46" y="16" width="70" height="22" rx="6" {...S} fill="var(--lime)" />
      <path d="M56 27h50" {...S} strokeWidth="2" />
      <path d="M110 100l6 24 6-8 9 9 5-5-9-9 8-5z" {...S} fill="var(--white)" />
      <circle cx="18" cy="24" r="4" fill="var(--lime)" stroke="var(--indigo)" strokeWidth="2" />
      <path d="M140 18l4 8M148 16l-8 4" {...S} />
    </svg>
  );
}

/** Share my place: a page outline with a location pin and the place message card. */
export function ShareArt() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 140">
      <rect x="20" y="16" width="84" height="108" rx="10" {...S} fill="var(--white)" />
      <path d="M34 36h40M34 50h56M34 64h48M34 78h52" {...S} strokeWidth="2" />
      <path d="M62 92c0-9 7-15 14-15s14 6 14 15c0 10-14 22-14 22S62 102 62 92z" {...S} fill="var(--lime)" />
      <circle cx="76" cy="92" r="4" {...S} fill="var(--white)" strokeWidth="2" />
      <rect x="92" y="28" width="56" height="40" rx="8" {...S} fill="var(--white)" />
      <path d="M100 42h40M100 54h28" {...S} strokeWidth="2" />
      <path d="M104 68l-6 10 14-10" {...S} fill="var(--white)" />
      <path d="M128 92c10 4 16 12 16 22" {...S} strokeDasharray="3 6" />
    </svg>
  );
}

/** Amharic answer with the English term beside it: two bubbles and a term chip. */
export function AmharicArt() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 140">
      <rect x="14" y="20" width="86" height="54" rx="14" fill="var(--white)" stroke="var(--white)" strokeWidth="2.5" />
      <text x="57" y="56" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--indigo)" fontFamily="var(--font-head)">አማ</text>
      <path d="M30 74l-4 14 16-14" fill="var(--white)" stroke="var(--white)" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="64" y="84" width="82" height="40" rx="20" fill="var(--lime)" stroke="var(--white)" strokeWidth="2.5" />
      <text x="105" y="110" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--indigo)" fontFamily="var(--font-mono)">(term)</text>
      <path d="M118 30c10 0 18 8 18 18" fill="none" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M130 44l6 6 6-8" fill="none" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Jobs: a briefcase and a checklist of supports. */
export function JobsArt() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 140">
      <rect x="14" y="54" width="90" height="62" rx="10" {...S} fill="var(--white)" />
      <path d="M44 54V42c0-4 3-7 7-7h18c4 0 7 3 7 7v12M14 80h90" {...S} />
      <rect x="51" y="74" width="16" height="12" rx="3" {...S} fill="var(--lime)" strokeWidth="2" />
      <rect x="94" y="18" width="52" height="68" rx="8" {...S} fill="var(--white)" />
      {[34, 50, 66].map((y) => (
        <g key={y}>
          <rect x="101" y={y - 6} width="12" height="12" rx="3" {...S} fill="var(--lime)" strokeWidth="2" />
          <path d={`M104 ${y}l2 3 4-5`} {...S} strokeWidth="2" />
          <path d={`M119 ${y}h19`} {...S} strokeWidth="2" />
        </g>
      ))}
      <path d="M118 112c3-10 12-16 22-16" {...S} strokeDasharray="3 6" />
      <circle cx="146" cy="96" r="4" fill="var(--lime)" stroke="var(--indigo)" strokeWidth="2" />
    </svg>
  );
}

/** The helper: a round face inside orbit rings, with sparkles. */
export function HelperArt() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 260 200">
      <ellipse cx="140" cy="104" rx="104" ry="30" {...S} />
      <ellipse cx="140" cy="112" rx="88" ry="22" {...S} strokeDasharray="5 7" />
      <circle cx="140" cy="80" r="40" fill="var(--indigo)" />
      <ellipse cx="127" cy="74" rx="6" ry="10" fill="var(--white)" />
      <ellipse cx="153" cy="74" rx="6" ry="10" fill="var(--white)" />
      <path d="M126 96c8 7 20 7 28 0" fill="none" stroke="var(--white)" strokeWidth="3" strokeLinecap="round" />
      <path d="M86 132c5 22 10 30 32 34-22 4-27 12-32 34-5-22-10-30-32-34 22-4 27-12 32-34z" fill="var(--lime)" stroke="var(--indigo)" strokeWidth="2.5" strokeLinejoin="round" transform="translate(0,-20) scale(0.9)" />
      <path d="M212 120c3 16 9 22 24 24-15 2-21 8-24 24-3-16-9-22-24-24 15-2 21-8 24-24z" fill="var(--mist)" stroke="var(--indigo)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="226" cy="40" r="5" fill="var(--lime)" stroke="var(--indigo)" strokeWidth="2" />
    </svg>
  );
}

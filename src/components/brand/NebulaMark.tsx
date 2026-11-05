import type { SVGProps } from "react";

export function NebulaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        <path d="m9 10 10 9m0 0 12-11M19 19l10 12M9 10 7 21l23 .4" stroke="currentColor" />
        <circle cx="9" cy="10" r="3.5" fill="var(--bg-panel)" stroke="var(--accent)" />
        <circle cx="19" cy="19" r="3.5" fill="var(--bg-panel)" stroke="var(--accent)" />
        <circle cx="31" cy="8" r="3.5" fill="var(--bg-panel)" stroke="var(--accent-secondary)" />
        <circle cx="29" cy="31" r="3.5" fill="var(--bg-panel)" stroke="var(--accent)" />
        <circle cx="6" cy="31" r="3" fill="var(--bg-panel)" stroke="var(--accent)" />
      </g>
    </svg>
  );
}

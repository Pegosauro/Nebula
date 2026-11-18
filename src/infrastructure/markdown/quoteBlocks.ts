export type QuoteBlockKind = "quote" | "tip" | "warning";
export const calloutTag = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;
export const quoteKinds = [
  { kind: "quote", label: "Citazione", path: "M4 12h6v6H4v-6a6 6 0 0 1 6-6m4 6h6v6h-6v-6a6 6 0 0 1 6-6" },
  { kind: "tip", label: "Suggerimento", path: "M9 18c0-1.4-.5-2.1-1.5-3.1A6 6 0 1 1 16.5 14.9c-1 1-1.5 1.7-1.5 3.1m-6 0h6m-5 3h4" },
  { kind: "warning", label: "Avviso", path: "M10.3 4.5a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3zm1.7 4.5v4.5m0 3.4h.01" },
] as const;

export function quoteKind(tag?: string): QuoteBlockKind | undefined {
  if (!tag) return "quote";
  if (tag === "TIP") return "tip";
  if (tag === "WARNING") return "warning";
}

// Generated only from our fixed paths, after sanitizing note HTML.
export function quoteBlockGlyph(kind: QuoteBlockKind | "plain", owner = document): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = owner.createElementNS(ns, "svg");
  const path = owner.createElementNS(ns, "path");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", kind === "plain" ? "M4 5h16M12 5v14m-4 0h8" : quoteKinds.find(item => item.kind === kind)!.path);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

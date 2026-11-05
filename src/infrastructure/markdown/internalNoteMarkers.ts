import { maskMarkdownCode } from "./parseKnowledge";
import { frontmatterRange, maskFrontmatter } from "../../domain/noteProperties";

/** Reserved capture comments are metadata, never rendered text. A timestamp
 * boundary still identifies a capture following an unfinished code fence. */
export function internalNoteMarkerRanges(source: string): Array<{ from: number; to: number }> {
  if (!source.includes("<!-- nebula-quick-note:")) return [];
  const metadataEnd = frontmatterRange(source)?.end ?? 0;
  const visible = maskMarkdownCode(maskFrontmatter(source));
  const ranges: Array<{ from: number; to: number }> = [];
  const pattern = /^<!-- nebula-quick-note:[^\r\n<>]+ -->[ \t]*(?:\r?\n|$)/gm;
  const captureHeading = /(?:^|\n)##[ \t]+\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}(?::\d{2})?[ \t]*\r?\n(?:\r?\n)?$/;
  for (const match of source.matchAll(pattern)) {
    const from = match.index;
    if (from < metadataEnd) continue;
    if (visible.slice(from, from + 4) !== "<!--" && !captureHeading.test(source.slice(Math.max(0, from - 100), from))) continue;
    ranges.push({ from, to: from + match[0].length });
  }
  return ranges;
}
export function maskInternalNoteMarkers(source: string): string {
  const pieces: string[] = [];
  let previous = 0;
  for (const { from, to } of internalNoteMarkerRanges(source)) {
    pieces.push(source.slice(previous, from), source.slice(from, to).replace(/[^\r\n]/g, " "));
    previous = to;
  }
  pieces.push(source.slice(previous));
  return pieces.join("");
}

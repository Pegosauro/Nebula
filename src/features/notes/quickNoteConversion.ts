import { markdownLanguage } from "@codemirror/lang-markdown";
import { maskFrontmatter } from "../../domain/noteProperties";
import { BUILTIN_TEMPLATES, instantiateTemplate } from "../templates/noteTemplates";
import { preparePersonalTemplate } from "../templates/preparePersonalTemplate";
import { QUICK_NOTES_PATH } from "./quickNotes";

export interface QuickNoteCapture { id: string; timestamp: string; text: string }

// Captures use timestamp headings. Explicit IDs also delimit new captures after
// an unfinished code fence; legacy timestamp-looking examples in code are ignored.
export function quickNoteCaptures(content: string): QuickNoteCapture[] {
  const headings = new Set<number>();
  markdownLanguage.parser.parse(maskFrontmatter(content)).iterate({ enter(node) {
    if (node.name === "ATXHeading2") headings.add(node.from);
  } });
  const boundaries: Array<{ from: number; bodyFrom: number; id: string; timestamp: string }> = [];
  const pattern = /^##[ \t]+(\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}(?::\d{2})?)[ \t]*\r?\n/gm;
  for (const match of content.matchAll(pattern)) {
    const end = match.index + match[0].length;
    const marker = /^(?:\r?\n)?<!-- nebula-quick-note:([^\r\n<>]+) -->\r?\n(?:\r?\n)?/.exec(content.slice(end));
    if (!marker && !headings.has(match.index)) continue;
    boundaries.push({ from: match.index, bodyFrom: end + (marker?.[0].length ?? 0), id: marker?.[1] ?? `legacy:${match.index}`, timestamp: match[1]! });
  }
  return boundaries.map((entry, index) => ({ id: `${entry.id}:${entry.from}`, timestamp: entry.timestamp,
    text: content.slice(entry.bodyFrom, boundaries[index + 1]?.from ?? content.length).replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, ""),
  })).filter(entry => entry.text.trim());
}

export function quickNoteDocument(capture: QuickNoteCapture, title: string, procedure: boolean, date = new Date()): string {
  // Substitute only the template: tokens and headings in the captured text stay literal.
  const original = preparePersonalTemplate(capture.text, QUICK_NOTES_PATH, { replaceTitle: false });
  const origin = `> Appunto del ${capture.timestamp}\n\n`;
  if (!procedure) return instantiateTemplate("# {{titolo}}\n\n", title, date) + origin + original + "\n";
  const template = instantiateTemplate(BUILTIN_TEMPLATES.find(item => item.id === "procedure")!.content!, title, date);
  // Put the source last: even an unfinished code block cannot swallow the structure.
  return template + `\n## Appunto di partenza\n\n` + origin + original + "\n";
}

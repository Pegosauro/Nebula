import { maskFrontmatter } from "../../domain/noteProperties";
import { markdownLanguage } from "@codemirror/lang-markdown";
export function taskMarkers(source: string): Array<{ from: number; to: number; checked: boolean }> {
  const markers: Array<{ from: number; to: number; checked: boolean }> = [];
  markdownLanguage.parser.parse(maskFrontmatter(source)).iterate({ enter(node) {
    if (node.name === "TaskMarker") markers.push({ from: node.from, to: node.to, checked: /x/i.test(source.slice(node.from, node.to)) });
  } });
  return markers;
}

/** Change only a verified Markdown task marker, keeping all other bytes intact. */
export function toggleMarkdownTask(source: string, from: number, checked: boolean): string {
  if (!taskMarkers(source).some(task => task.from === from)) return source;
  return source.slice(0, from + 1) + (checked ? "x" : " ") + source.slice(from + 2);
}

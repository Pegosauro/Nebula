import { frontmatterRange, maskFrontmatter } from "../../domain/noteProperties";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";

// Preserve local assets when a model is reused in a different folder. Code examples
// remain literal; only Markdown URLs and the first real level-one heading change.
export function preparePersonalTemplate(content: string, sourcePath: string, options: { replaceTitle?: boolean } = {}): string {
  const edits: Array<{ from: number; to: number; text: string }> = [];
  let headingFound = false;
  markdownLanguage.parser.parse(maskFrontmatter(content)).iterate({ enter(node) {
    if (options.replaceTitle !== false && !headingFound && node.name === "ATXHeading1") {
      const line = content.slice(node.from, node.to);
      const marker = /^#\s+/.exec(line);
      if (marker) { edits.push({ from: node.from + marker[0].length, to: node.to, text: "{{titolo}}" }); headingFound = true; return false; }
    }
    if (node.name !== "URL") return;
    const raw = content.slice(node.from, node.to);
    const bracketed = raw.startsWith("<") && raw.endsWith(">");
    const reference = bracketed ? raw.slice(1, -1) : raw;
    if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference)) return;
    const split = reference.search(/[?#]/);
    const target = split < 0 ? reference : reference.slice(0, split);
    const suffix = split < 0 ? "" : reference.slice(split);
    const path = resolveImagePath(sourcePath, target);
    const rebased = `/${path.split("/").map(encodeURIComponent).join("/")}${suffix}`;
    edits.push({ from: node.from, to: node.to, text: bracketed ? `<${rebased}>` : rebased });
  } });
  let result = content;
  for (const edit of edits.sort((a, b) => b.from - a.from)) result = result.slice(0, edit.from) + edit.text + result.slice(edit.to);
  if (headingFound || options.replaceTitle === false) return result;
  const end = frontmatterRange(result)?.end ?? 0;
  return result.slice(0, end) + `# {{titolo}}\n\n` + result.slice(end);
}

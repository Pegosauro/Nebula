import type { TextComment } from "../../domain/textComments";

const blockSelector = "p,li,pre,div,blockquote,h1,h2,h3,h4,h5,h6,td,th,br";
const excluded = ".local-image,.quote-block-icon,.callout-label";

function project(root: ParentNode) {
  const nodes: Array<{ node: Text; from: number; to: number }> = [];
  let text = "";
  function read(parent: ParentNode) {
    for (const child of parent.childNodes) {
      if (child instanceof Text) {
        const from = text.length;
        text += child.data;
        nodes.push({ node: child, from, to: text.length });
      } else if (child instanceof Element && !child.matches(excluded)) {
        const block = child.matches(blockSelector);
        if (block) text += " ";
        read(child);
        if (block) text += " ";
      }
    }
  }
  read(root);
  return { text, nodes };
}

function occurrences(text: string, quote: string): number[] {
  const matches: number[] = [];
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) matches.push(at);
  return matches;
}

export function decorateRenderedComments(html: string, body: string, comments: readonly TextComment[], renderQuote: (quote: string) => string): string {
  if (!comments.some(comment => comment.from !== null)) return html;
  const root = document.createElement("div");
  root.innerHTML = html;
  const rendered = project(root);
  const normalized = body.replace(/\r\n?/g, "\n");
  const marks = new Map<Text, Array<{ id: string; from: number; to: number; first: boolean }>>();
  const fragment = document.createElement("template");
  for (const comment of comments) {
    if (comment.from === null) continue;
    const sourceMatches = occurrences(normalized, comment.quote);
    const ordinal = sourceMatches.indexOf(comment.from);
    if (ordinal < 0) continue;
    fragment.innerHTML = renderQuote(comment.quote);
    const quote = project(fragment.content).text.trim().replace(/\s+/gu, " ");
    if (!quote) continue;
    const pattern = quote.split(" ").map(word => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("\\s+");
    const candidates = [...rendered.text.matchAll(new RegExp(pattern, "gu"))];
    // A difference in the number of occurrences can mean Markdown hid a
    // source match. In that case the comment remains available in the list.
    if (candidates.length !== sourceMatches.length
      || candidates.length > 1 && quote !== comment.quote.trim().replace(/\s+/gu, " ")) continue;
    const candidate = candidates[ordinal]!;
    const start = candidate.index, end = start + candidate[0].length;
    let first = true;
    for (const { node, from, to } of rendered.nodes) {
      if (to <= start) continue;
      if (from >= end) break;
      const list = marks.get(node) ?? [];
      list.push({ id: comment.id, from: Math.max(from, start) - from, to: Math.min(to, end) - from, first });
      marks.set(node, list);
      first = false;
    }
  }
  for (const [node, ranges] of marks) {
    let end = node.length;
    for (const range of ranges.sort((a, b) => b.from - a.from)) {
      if (range.to > end) continue;
      node.splitText(range.to);
      const selected = node.splitText(range.from);
      const mark = document.createElement("span");
      mark.className = "text-comment-anchor";
      mark.dataset.textComment = range.id;
      if (range.first && !node.parentElement?.closest("a")) mark.tabIndex = 0;
      selected.replaceWith(mark);
      mark.append(selected);
      end = range.from;
    }
  }
  return root.innerHTML;
}

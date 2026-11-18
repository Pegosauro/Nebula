import { calloutTag, quoteBlockGlyph, quoteKind } from "./quoteBlocks";
import { maskInternalNoteMarkers } from "./internalNoteMarkers";
import { withoutFrontmatter } from "../../domain/noteProperties";
import DOMPurify from "dompurify";
import { Marked, type Token, type Tokens } from "marked";
import { markdownTables } from "../../features/editor/markdownTools";
import { applyTableLayout } from "./renderTableLayout";
import type { KnowledgeIndexData } from "../../domain/knowledge";
import { resolveKnowledgeTarget } from "../../domain/resolveKnowledge";
import { parseWikilinks } from "./parseKnowledge";
import { highlightPattern, splitHighlight } from "../../domain/markdownHighlight";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function renderWikilinks(source: string, knowledge: KnowledgeIndexData): string {
  const documents = knowledge.documents;
  let output = source;
  for (const link of parseWikilinks(source).toReversed()) {
    const candidates = resolveKnowledgeTarget(link.target, documents);
    const status = candidates.length === 1 ? "resolved" : candidates.length > 1 ? "ambiguous" : "unresolved";
    const title = status === "resolved" ? candidates[0] ?? link.target : status === "ambiguous" ? `${candidates.length} possibili destinazioni` : "Nota non ancora creata";
    const anchor = `<a href="#" class="nebula-wikilink is-${status}" data-nebula-target="${escapeHtml(link.target)}" title="${escapeHtml(title)}">${escapeHtml(link.display)}</a>`;
    output = `${output.slice(0, link.start)}${anchor}${output.slice(link.end)}`;
  }
  return output;
}
function preserveQuoteLines(tokens: Token[]): Token[] {
  return tokens.flatMap<Token>(token => {
    // Nested quotes pass through the same renderer. Image descriptions stay inline.
    if (token.type === "blockquote" || token.type === "image") return token;
    if (token.type === "list") {
      const list = token as Tokens.List;
      return { ...list, items: list.items.map(item => ({ ...item, tokens: preserveQuoteLines(item.tokens) })) };
    }
    if ("tokens" in token && token.tokens) return { ...token, tokens: preserveQuoteLines(token.tokens) };
    if (token.type !== "text") return token;
    const leaf = token as Tokens.Text;
    if (leaf.escaped || !leaf.text.includes("\n")) return token;

    // Only Markdown soft breaks remain in plain text tokens. Explicit breaks
    // and the contents of code spans already have their own token types.
    return leaf.text.split("\n").flatMap<Token>((text, index) => {
      const line: Token[] = index ? [{ type: "br", raw: "\n" }] : [];
      if (text) line.push({ ...leaf, text, raw: text });
      return line;
    });
  });
}

const parser = new Marked({ gfm: true, breaks: false });
parser.use({
  extensions: [{
    name: "highlight", level: "inline",
    start: src => src.indexOf("=="),
    tokenizer(src) {
      const match = highlightPattern.exec(src);
      if (!match) return;
      const { text, color, emojiLength } = splitHighlight(match[1]!);
      return { type: "highlight", raw: match[0], text, color: emojiLength ? color.name : null, tokens: this.lexer.inlineTokens(text) };
    },
    renderer(token) { return `<mark${token.color ? ` data-highlight-color="${token.color}"` : ""}>${this.parser.parseInline(token.tokens!)}</mark>`; },
  }],
  renderer: {
    blockquote({ tokens }) {
      return `<blockquote>\n${this.parser.parse(preserveQuoteLines(tokens))}</blockquote>\n`;
    },
    table(token) {
      const key = (token as Tokens.Table & { nebulaKey?: string }).nebulaKey;
      if (key === undefined) return false;
      const row = (cells: Tokens.TableCell[], header: boolean) => `<tr>${cells.map((cell, column) => {
        const tag = header ? "th" : "td", align = token.align[column];
        return `<${tag}${align ? ` align="${align}"` : ""}>${this.parser.parseInline(cell.tokens)}</${tag}>`;
      }).join("")}</tr>`;
      return `<table data-nebula-table="${key}"><thead>${row(token.header, true)}</thead><tbody>${token.rows.map(cells => row(cells, false)).join("")}</tbody></table>\n`;
    },
    checkbox(token) {
      const key = (token as Tokens.Checkbox & { nebulaKey?: string }).nebulaKey;
      return `<input type="checkbox"${key ? ` data-nebula-task="${key}"` : ""} disabled${token.checked ? " checked" : ""}>`;
    },
    image({ href, text }) {
      if (/^https?:\/\//i.test(href)) return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" referrerpolicy="no-referrer">`;
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) return `<span class="image-error">Immagine non supportata</span>`;
      return `<span class="local-image" data-nebula-image="${escapeHtml(href)}" role="img" aria-label="${escapeHtml(text || "Immagine")}">Caricamento immagine…</span>`;
    },
  },
});
export function renderMarkdownSafe(source: string, knowledge?: KnowledgeIndexData, options?: { omitMedia?: boolean }): string {
  source = maskInternalNoteMarkers(withoutFrontmatter(source));
  const tables = source.includes("<!-- nebula-table:") ? markdownTables(source) : [];
  const tokens = parser.lexer(knowledge ? renderWikilinks(source, knowledge) : source);
  const tablePrefix = `${crypto.randomUUID()}:`;
  let index = 0;
  for (const token of tokens) if (token.type === "table") (token as Tokens.Table & { nebulaKey: string }).nebulaKey = `${tablePrefix}${index++}`;
  let taskIndex = 0;
  parser.walkTokens(tokens, token => {
    if (token.type === "checkbox") (token as Tokens.Checkbox & { nebulaKey: string }).nebulaKey = `${tablePrefix}${taskIndex++}`;
  });
  const rendered = parser.parser(tokens);
  const safe = DOMPurify.sanitize(rendered, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "svg", "math", ...(options?.omitMedia ? ["img", "video", "audio", "source"] : [])],
    FORBID_ATTR: ["style", "srcdoc", "srcset", "contenteditable", "data-task-index"],
    ADD_ATTR: ["data-nebula-target", "data-nebula-image", "data-nebula-task", "data-nebula-table", "referrerpolicy"],
  });
  const container = document.createElement("div"); container.innerHTML = safe;
  for (const input of container.querySelectorAll<HTMLInputElement>("input[data-nebula-task]")) {
    const key = input.dataset.nebulaTask!;
    if (input.type !== "checkbox" || !key.startsWith(tablePrefix)) { input.removeAttribute("data-nebula-task"); continue; }
    input.dataset.nebulaTask = key.slice(tablePrefix.length);
    input.closest("li")?.classList.add("nebula-task-item");
  }
  for (const table of container.querySelectorAll<HTMLTableElement>("table[data-nebula-table]")) {
    // Raw HTML cannot impersonate the generated Markdown table indexes.
    const key = table.dataset.nebulaTable!;
    if (!key.startsWith(tablePrefix)) { table.removeAttribute("data-nebula-table"); continue; }
    const tableIndex = Number(key.slice(tablePrefix.length)); table.dataset.nebulaTable = String(tableIndex);
    const layout = tables[tableIndex]?.layout;
    if (layout) applyTableLayout(table, layout);
  }
  // Raw HTML images get the same safe path handling as Markdown images.
  for (const img of container.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (!/^https?:\/\//i.test(src)) {
      if (src && !/^[a-z][a-z\d+.-]*:|^\/\//i.test(src)) {
        const placeholder = document.createElement("span"); placeholder.className = "local-image";
        placeholder.dataset.nebulaImage = src; placeholder.setAttribute("role", "img"); placeholder.setAttribute("aria-label", img.alt || "Immagine"); placeholder.textContent = "Caricamento immagine…"; img.replaceWith(placeholder);
      } else img.remove();
    } else { img.loading = "lazy"; img.referrerPolicy = "no-referrer"; }
  }
  for (const a of container.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (/^https?:|^mailto:/i.test(a.getAttribute("href") ?? "")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  }
  for (const quote of container.querySelectorAll("blockquote")) {
    const nested = quote.parentElement?.closest("blockquote");
    const p = quote.firstElementChild;
    const first = p?.tagName === "P" && p.firstChild?.nodeType === Node.TEXT_NODE ? p.firstChild : null;
    const match = calloutTag.exec(first?.textContent ?? "");
    const tag = match?.[1]?.toUpperCase();
    const kind = quoteKind(tag);
    if (first && match && tag) {
      const body = first.textContent!.slice(match[0].length).trimStart();
      if (body) first.textContent = body;
      else {
        if (first.nextSibling?.nodeName === "BR") first.nextSibling.remove();
        first.remove();
        if (!p!.textContent?.trim() && p!.children.length === 0) p!.remove();
      }
      if (!nested) quote.classList.add("markdown-callout", `callout-${tag.toLowerCase()}`);
    }
    // Scrittura uses the outer block type for the entire quote.
    if (nested) continue;
    if (kind) {
      quote.classList.add("nebula-quote-block", `quote-block-${kind}`);
      const content = document.createElement("div");
      content.className = "quote-block-content";
      content.append(...quote.childNodes);
      const icon = document.createElement("span");
      icon.className = "quote-block-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.append(quoteBlockGlyph(kind));
      quote.append(icon, content);
    } else if (tag) {
      const labels: Record<string, string> = { NOTE: "Nota", IMPORTANT: "Importante", CAUTION: "Avvertenza" };
      const label = document.createElement("strong");
      label.className = "callout-label";
      label.textContent = labels[tag]!;
      quote.prepend(label);
    }
  }
  return container.innerHTML;
}

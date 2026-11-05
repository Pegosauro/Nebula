import { maskInternalNoteMarkers } from "./internalNoteMarkers";
import { withoutFrontmatter } from "../../domain/noteProperties";
import DOMPurify from "dompurify";
import { Marked, type Tokens } from "marked";
import { markdownTables } from "../../features/editor/markdownTools";
import { applyTableLayout } from "./renderTableLayout";
import type { KnowledgeIndexData } from "../../domain/knowledge";
import { resolveKnowledgeTarget } from "../../domain/resolveKnowledge";
import { parseWikilinks } from "./parseKnowledge";

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
const parser = new Marked({ gfm: true, breaks: false });
parser.use({
  extensions: [{
    name: "highlight", level: "inline",
    start: src => src.indexOf("=="),
    tokenizer(src) {
      const match = /^==([^=\n](?:[^\n]*?[^=\n])?)==/.exec(src);
      if (match) return { type: "highlight", raw: match[0], text: match[1], tokens: this.lexer.inlineTokens(match[1]!) };
    },
    renderer(token) { return `<mark>${this.parser.parseInline(token.tokens!)}</mark>`; },
  }],
  renderer: {
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
    const p = quote.querySelector("p"); const first = p?.firstChild;
    if (first?.nodeType !== 3) continue;
    const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.textContent ?? "");
    if (!match) continue;
    const labels: Record<string, string> = { NOTE: "Nota", TIP: "Suggerimento", IMPORTANT: "Importante", WARNING: "Attenzione", CAUTION: "Avvertenza" };
    first.textContent = first.textContent!.slice(match[0].length);
    quote.classList.add("markdown-callout", `callout-${match[1]!.toLowerCase()}`);
    const label = document.createElement("strong"); label.className = "callout-label"; label.textContent = labels[match[1]!.toUpperCase()]; quote.prepend(label);
  }
  return container.innerHTML;
}

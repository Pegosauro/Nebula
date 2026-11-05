import { withoutFrontmatter } from "./noteProperties";
import { basename, dirname, withoutMarkdownExtension } from "./path";
import type { KnowledgeSourceDocument, ParsedKnowledgeDocument } from "./knowledge";
import type { SearchMode, SearchResult } from "./search";
import { maskMarkdownCode, parseFrontmatterAliases } from "../infrastructure/markdown/parseKnowledge";

export interface QuickSearchSource { path: string; title?: string; aliases?: string[]; modifiedAt?: number }

interface QuickSearchDocument {
  path: string;
  title: string;
  basename: string;
  aliases: string[];

  foldedTitle: string;
  foldedBasename: string;
  foldedPath: string;
  foldedAliases: string[];

  modifiedAt?: number;
}

interface SearchDocument extends QuickSearchDocument {
  tags: string[]; content: string; foldedTags: string[]; foldedContent: string;
}

export function buildQuickSearchDocument(source: QuickSearchSource): QuickSearchDocument {
  const base = noteBasename(source.path), title = source.title || base, aliases = source.aliases ?? [];
  return { path: source.path, title, basename: base, aliases, foldedTitle: fold(title), foldedBasename: fold(base), foldedPath: fold(source.path.replace(/\.md$/iu, "")), foldedAliases: aliases.map(fold), modifiedAt: source.modifiedAt };
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase().trim();
}

function noteBasename(path: string): string {
  return basename(path).replace(/\.md$/iu, "");
}


function extractTitle(source: string, fallback: string): string {
  const visible = maskMarkdownCode(withoutFrontmatter(source));
  const heading = visible.match(/^\s*#\s+(.+)$/mu)?.[1]?.trim();
  return heading || fallback;
}

function parseFrontmatterTags(source: string): string[] {
  const frontmatter = source.replace(/^\uFEFF/, "").match(/^---\s*\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  if (!frontmatter) return [];
  const lines = frontmatter.split(/\r?\n/u);
  const tags: string[] = [];
  let inTags = false;
  for (const line of lines) {
    const key = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/u);
    if (key) {
      inTags = key[1]?.toLocaleLowerCase() === "tags";
      if (inTags && key[2]) {
        const value = key[2].trim();
        const items = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1).split(",") : [value];
        tags.push(...items.map((item) => item.trim().replace(/^['"]|['"]$/gu, "").replace(/^#/u, "")).filter(Boolean));
      }
      continue;
    }
    if (inTags) {
      const item = line.match(/^\s*-\s+(.+)$/u)?.[1]?.trim().replace(/^['"]|['"]$/gu, "").replace(/^#/u, "");
      if (item) tags.push(item);
      else if (line.trim()) inTags = false;
    }
  }
  return tags;
}

function extractTags(source: string): string[] {
  const visible = maskMarkdownCode(withoutFrontmatter(source));
  const inline = [...visible.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map((match) => match[1] ?? "").filter(Boolean);
  return [...new Set([...parseFrontmatterTags(source), ...inline])];
}

function cleanSnippet(value: string): string {
  return value
    .replace(/^---\s*[\s\S]*?---\s*/u, "")
    .replace(/!??\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu, "$2$1")
    .replace(/(^|\s)[#>*_`~-]+/gu, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function createSnippet(content: string, terms: string[]): string {
  const paragraphs = withoutFrontmatter(content).split(/\r?\n\s*\r?\n|\r?\n/u).map(cleanSnippet).filter(Boolean);
  const matching = paragraphs.find((paragraph) => terms.some((term) => fold(paragraph).includes(term))) ?? paragraphs[0] ?? "Nota senza contenuto";
  return matching.length > 170 ? `${matching.slice(0, 167).trimEnd()}…` : matching;
}

function fuzzySubsequenceScore(value: string, query: string): number {
  if (!query) return 0;
  let cursor = 0;
  let gap = 0;
  for (const character of query) {
    const found = value.indexOf(character, cursor);
    if (found < 0) return 0;
    gap += found - cursor;
    cursor = found + 1;
  }
  return Math.max(1, 260 - gap * 4 - (value.length - query.length));
}

export function buildSearchDocument(source: KnowledgeSourceDocument, parsed?: ParsedKnowledgeDocument): SearchDocument {
  const base = noteBasename(source.path);
  const aliases = parsed?.aliases ?? parseFrontmatterAliases(source.content);
  const tags = extractTags(source.content);
  const title = extractTitle(source.content, base);
  return {
    path: source.path,
    title,
    basename: base,
    aliases,
    tags,
    content: source.content,
    foldedTitle: fold(title),
    foldedBasename: fold(base),
    foldedPath: fold(source.path.replace(/\.md$/iu, "")),
    foldedAliases: aliases.map(fold),
    foldedTags: tags.map(fold),
    foldedContent: fold(source.content),
    modifiedAt: source.lastModified,
  };
}

function rankQuick(document: QuickSearchDocument, query: string, recentBoost: number): { score: number; match: SearchResult["match"] } | undefined {
  if (!query) return { score: recentBoost || 1, match: recentBoost ? "recent" : "title" };
  if (document.foldedTitle === query || document.foldedBasename === query) return { score: 1000 + recentBoost, match: "title" };
  if (document.foldedTitle.startsWith(query) || document.foldedBasename.startsWith(query)) return { score: 820 + recentBoost, match: "title" };
  const fuzzy = Math.max(fuzzySubsequenceScore(document.foldedTitle, query), fuzzySubsequenceScore(document.foldedBasename, query));
  if (fuzzy) return { score: 560 + fuzzy + recentBoost, match: "title" };
  if (document.foldedPath.includes(query)) return { score: 430 + recentBoost, match: "path" };
  const alias = document.foldedAliases.find((value) => value === query || value.startsWith(query) || value.includes(query));
  if (alias) return { score: (alias === query ? 520 : 390) + recentBoost, match: "alias" };
  return undefined;
}

function rankFull(document: SearchDocument, terms: string[]): { score: number; match: SearchResult["match"] } | undefined {
  const searchable = [document.foldedTitle, document.foldedPath, ...document.foldedAliases, ...document.foldedTags, document.foldedContent];
  if (!terms.every((term) => searchable.some((value) => value.includes(term)))) return undefined;
  let score = 0;
  let match: SearchResult["match"] = "content";
  for (const term of terms) {
    if (document.foldedTitle === term || document.foldedBasename === term) { score += 1000; match = "title"; }
    else if (document.foldedTitle.startsWith(term) || document.foldedBasename.startsWith(term)) { score += 720; match = "title"; }
    else if (document.foldedPath.includes(term)) { score += 430; if (match === "content") match = "path"; }
    else if (document.foldedAliases.some((value) => value.includes(term))) { score += 390; if (match === "content") match = "alias"; }
    else if (document.foldedTags.some((value) => value.includes(term))) { score += 350; if (match === "content") match = "tag"; }
    else if (document.foldedContent.includes(term)) score += 120;
  }
  return { score, match };
}

const titleOrder = new Intl.Collator(undefined, { sensitivity: "base" });

export function searchQuickDocuments(documents: Iterable<QuickSearchDocument>, query: string, recentPaths: string[] = [], limit = 30): SearchResult[] {
  if (limit <= 0) return [];
  const normalized = fold(query), recent = new Map(recentPaths.map((path, index) => [path, Math.max(0, 120 - index * 12)]));
  type Ranked = { document: QuickSearchDocument; score: number; match: SearchResult["match"] };
  const best: Ranked[] = [];
  const compare = (a: Ranked, b: Ranked) => b.score - a.score || titleOrder.compare(a.document.title, b.document.title);
  // Keep only the visible winners instead of allocating and sorting every match.
  for (const document of documents) {
    const ranking = rankQuick(document, normalized, recent.get(document.path) ?? 0);
    if (!ranking) continue;
    const item = { document, ...ranking };
    if (best.length === limit && compare(item, best[limit - 1]!) >= 0) continue;
    let low = 0, high = best.length;
    while (low < high) { const mid = (low + high) >>> 1; if (compare(item, best[mid]!) < 0) high = mid; else low = mid + 1; }
    best.splice(low, 0, item); if (best.length > limit) best.pop();
  }
  return best.map(({ document, score, match }) => ({ path: document.path, title: document.title, breadcrumb: dirname(document.path) || "Vault", snippet: document.aliases[0] || withoutMarkdownExtension(document.path), aliases: document.aliases, tags: [], score, modifiedAt: document.modifiedAt, match }));
}

export function searchDocuments(
  documents: Iterable<SearchDocument>,
  query: string,
  mode: SearchMode,
  recentPaths: string[] = [],
  limit = 50,
): SearchResult[] {
  if (mode === "quick") return searchQuickDocuments(documents, query, recentPaths, limit);
  const foldedQuery = fold(query);
  const terms = foldedQuery.split(/\s+/u).filter(Boolean);
  if (mode === "full" && !terms.length) return [];
  const ranked: Array<{ document: SearchDocument; score: number; match: SearchResult["match"] }> = [];

  for (const document of documents) {
    const ranking = rankFull(document, terms);
    if (!ranking) continue;
    ranked.push({ document, ...ranking });
  }

  // Snippets only belong to the visible results. Reuse a collator instead of
  // constructing one for every comparison in a large vault.
  return ranked.sort((left, right) => right.score - left.score || titleOrder.compare(left.document.title, right.document.title)).slice(0, limit).map(({ document, score, match }) => ({
      path: document.path,
      title: document.title,
      breadcrumb: dirname(document.path) || "Vault",
      snippet: mode === "full" ? createSnippet(document.content, terms) : document.aliases[0] || withoutMarkdownExtension(document.path),
      aliases: document.aliases,
      tags: document.tags,
      score,
      modifiedAt: document.modifiedAt,
      match,
    }));
}

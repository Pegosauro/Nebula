import { maskFrontmatter } from "../../domain/noteProperties";
import type { ParsedKnowledgeDocument, ParsedWikilink } from "../../domain/knowledge";

const FRONTMATTER_BOUNDARY = /^---\s*$/u;
const FENCED_CODE = /^(\s*)(```|~~~)/u;
const WIKILINK = /(!)?\[\[([^\]\n]+)\]\]/gu;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseInlineList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return trimmed ? [stripQuotes(trimmed)] : [];
  return trimmed.slice(1, -1).split(",").map(stripQuotes).filter(Boolean);
}

export function parseFrontmatterAliases(source: string): string[] {
  const lines = source.split(/\r?\n/u);
  if (!FRONTMATTER_BOUNDARY.test(lines[0] ?? "")) return [];
  let inAliases = false;
  const aliases: string[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FRONTMATTER_BOUNDARY.test(line)) break;
    const key = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/u);
    if (key) {
      inAliases = key[1]?.toLocaleLowerCase() === "aliases" || key[1]?.toLocaleLowerCase() === "alias";
      if (inAliases && key[2]) aliases.push(...parseInlineList(key[2]));
      continue;
    }
    if (inAliases) {
      const item = line.match(/^\s*-\s+(.+)$/u);
      if (item?.[1]) aliases.push(stripQuotes(item[1]));
      else if (line.trim()) inAliases = false;
    }
  }

  return [...new Set(aliases.filter(Boolean))];
}

export function maskMarkdownCode(source: string): string {
  const characters = source.split("");
  const lines = source.split(/(?<=\n)/u);
  let offset = 0;
  let fence: string | undefined;

  for (const line of lines) {
    const marker = line.match(FENCED_CODE)?.[2];
    const shouldMask = Boolean(fence || marker);
    if (shouldMask) {
      for (let index = offset; index < offset + line.length; index += 1) {
        if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
      }
    }
    if (marker) fence = fence ? undefined : marker;
    offset += line.length;
  }

  const masked = characters.join("");
  return masked.replace(/`+[^`\n]*`+/gu, (segment) => segment.replace(/[^\r\n]/gu, " "));
}

function parseTarget(value: string): { target: string; display: string; heading?: string } | undefined {
  const [destination = "", alias] = value.split("|", 2);
  const [targetPart = "", heading] = destination.split("#", 2);
  const target = targetPart.trim().replace(/\.md$/iu, "").replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
  if (!target || target.split("/").some((segment) => segment === "." || segment === "..")) return undefined;
  return {
    target,
    display: alias?.trim() || `${target.split("/").at(-1) || target}${heading?.trim() ? `#${heading.trim()}` : ""}`,
    heading: heading?.trim() || undefined,
  };
}

export function parseWikilinks(source: string): ParsedWikilink[] {
  const masked = maskMarkdownCode(maskFrontmatter(source));
  const links: ParsedWikilink[] = [];
  for (const match of masked.matchAll(WIKILINK)) {
    if (match[1]) continue;
    const parsed = parseTarget(match[2] ?? "");
    if (!parsed || match.index === undefined) continue;
    const raw = source.slice(match.index, match.index + match[0].length);
    links.push({
      raw,
      ...parsed,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return links;
}

export function parseKnowledgeDocument(path: string, source: string): ParsedKnowledgeDocument {
  return {
    path,
    aliases: parseFrontmatterAliases(source),
    links: parseWikilinks(source),
  };
}

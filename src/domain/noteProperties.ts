/** A deliberately small, non-destructive editor for optional YAML properties.
 * Unknown keys, comments and the Markdown body remain byte-for-byte intact. */
export const PROPERTY_KEYS = ["type", "category", "status", "revision", "tags"] as const;
export type PropertyKey = typeof PROPERTY_KEYS[number];
export interface Frontmatter { from: number; end: number; contentFrom: number; contentTo: number; newline: string }
export function frontmatterRange(source: string): Frontmatter | undefined {
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(source);
  if (!opening) return;
  const closing = /^---[ \t]*(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(source);
  if (!match) return;
  return { from: source.charCodeAt(0) === 0xfeff ? 1 : 0, end: match.index + match[0].length, contentFrom: opening[0].length, contentTo: match.index, newline: opening[0].endsWith("\r\n") ? "\r\n" : "\n" };
}
export const withoutFrontmatter = (source: string) => source.slice(frontmatterRange(source)?.end ?? 0);
export function maskFrontmatter(source: string): string {
  const range = frontmatterRange(source);
  return range ? source.slice(0, range.end).replace(/[^\r\n]/g, " ") + source.slice(range.end) : source;
}
function scalar(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith('"')) { try { const decoded: unknown = JSON.parse(value); return typeof decoded === "string" ? decoded : undefined; } catch { return; } }
  if (/^'(?:[^']|'')*'$/.test(value)) return value.slice(1, -1).replaceAll("''", "'");
  if (/^[\[\]{|>&*!]/.test(value) || /:\s/.test(value)) return;
  return value.replace(/\s+#.*$/, "").trim();
}
function tagValue(raw: string): string[] | undefined {
  const text = raw.trim();
  if (text.startsWith("[")) {
    try { const value: unknown = JSON.parse(text); if (Array.isArray(value) && value.every(item => typeof item === "string")) return value; } catch { /* Accept simple YAML inline lists too. */ }
    if (!text.endsWith("]")) return;
    const pieces: string[] = [];
    let quote = "", start = 1;
    for (let i = 1; i < text.length - 1; i++) {
      const char = text[i]!;
      if (quote) {
        if (quote === '"' && char === "\\") { i++; continue; }
        if (char === quote) { if (quote === "'" && text[i + 1] === "'") i++; else quote = ""; }
      } else if (char === '"' || char === "'") quote = char;
      else if (char === ",") { pieces.push(text.slice(start, i)); start = i + 1; }
    }
    if (quote) return;
    pieces.push(text.slice(start, -1));
    const values = pieces.filter(item => item.trim()).map(scalar);
    return values.every(value => value !== undefined) ? values as string[] : undefined;
  }
  const value = scalar(text);
  return value === undefined ? undefined : value ? [value] : [];
}
interface Field { from: number; to: number; raw: string; continuation: string[] }
function fields(source: string, key: PropertyKey, range: Frontmatter): Field[] {
  const lines = source.slice(range.contentFrom, range.contentTo).match(/[^\n]*(?:\n|$)/g)?.filter(Boolean) ?? [];
  const result: Field[] = [];
  let offset = range.contentFrom;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = new RegExp(`^(?:${key}|"${key}"|'${key}'):[ \\t]*(.*?)(?:\\r?\\n|$)$`).exec(line);
    if (match) {
      const continuation: string[] = [];
      let to = offset + line.length;
      const gaps: string[] = [];
      let scannedTo = to;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j]!;
        scannedTo += next.length;
        if (/^\s*(?:#.*)?$/.test(next.trimEnd())) { gaps.push(next); continue; }
        if (!/^[ \t]+\S/.test(next) && !/^- /.test(next)) break;
        continuation.push(...gaps, next); gaps.length = 0; to = scannedTo;
      }
      result.push({ from: offset, to, raw: match[1]!, continuation });
    }
    offset += line.length;
  }
  return result;
}
function decode(field: Field, key: PropertyKey): string | string[] | undefined {
  if (!field.continuation.length) return key === "tags" ? tagValue(field.raw) : scalar(field.raw);
  if (key !== "tags" || field.raw.trim()) return;
  const values = field.continuation.map(line => /^\s*-\s+(.*?)\s*$/.exec(line)?.[1]).map(raw => raw === undefined ? undefined : scalar(raw));
  return values.every(value => value !== undefined) ? values as string[] : undefined;
}
export function readNoteProperties(source: string): { values: Record<PropertyKey, string>; unsupported: PropertyKey[]; malformed: boolean } {
  const values: Record<PropertyKey, string> = { type: "", category: "", status: "", revision: "", tags: "" };
  const range = frontmatterRange(source);
  const unsupported: PropertyKey[] = [];
  if (range) for (const key of PROPERTY_KEYS) {
    const found = fields(source, key, range);
    if (!found.length) continue;
    const decoded = found.length === 1 ? decode(found[0]!, key) : undefined;
    if (decoded === undefined || (Array.isArray(decoded) && decoded.some(tag => tag.includes(",")))) unsupported.push(key);
    else values[key] = Array.isArray(decoded) ? decoded.join(", ") : decoded;
  }
  return { values, unsupported, malformed: /^(?:\uFEFF)?---[ \t]*\r?\n/.test(source) && !range };
}
export function updateNoteProperty(source: string, key: PropertyKey, value: string): string {
  const range = frontmatterRange(source);
  const parsed = readNoteProperties(source);
  if (parsed.malformed || parsed.unsupported.includes(key)) throw new Error("Questa proprietà YAML richiede una modifica in Sorgente.");
  const newline = range?.newline ?? (source.includes("\r\n") ? "\r\n" : "\n");
  const tags = [...new Set(value.split(",").map(item => item.trim().replace(/^#/, "")).filter(Boolean))];
  const serialized = key === "tags" ? JSON.stringify(tags) : JSON.stringify(value);
  const empty = key === "tags" ? !tags.length : !value.trim();
  const line = empty ? "" : `${key}: ${serialized}${newline}`;
  if (!range) return empty ? source : `${source.startsWith("\uFEFF") ? "\uFEFF" : ""}---${newline}${line}---${newline}${source.replace(/^\uFEFF/, "")}`;
  const found = fields(source, key, range)[0];
  const changed = found ? source.slice(0, found.from) + line + source.slice(found.to) : source.slice(0, range.contentTo) + line + source.slice(range.contentTo);
  const nextRange = frontmatterRange(changed)!;
  // Removing the final property leaves an ordinary note again. Preserve unrelated comments/keys.
  return changed.slice(nextRange.contentFrom, nextRange.contentTo).trim() ? changed : changed.slice(0, nextRange.from) + changed.slice(nextRange.end);
}

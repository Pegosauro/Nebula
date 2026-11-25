import { frontmatterRange } from "./noteProperties";

export interface TextComment {
  id: string;
  text: string;
  quote: string;
  before: string;
  after: string;
  from: number | null;
}

const trailer = /\r?\n\r?\n<!-- nebula-text-comments:v1 ([^\r\n<>]+) -->(?:\r?\n|$)/gu;
const contextLength = 48;
const maxQuoteLength = 4000;
export const maxCommentLength = 2000;

export function anchorTextComment(body: string, from: number, to: number) {
  return {
    from,
    quote: body.slice(from, to),
    before: body.slice(Math.max(0, from - contextLength), from),
    after: body.slice(to, to + contextLength),
  };
}

function isTextComment(value: unknown): value is TextComment {
  if (!value || typeof value !== "object") return false;
  const c = value as TextComment;
  return typeof c.id === "string" && /^[a-f0-9-]{36}$/u.test(c.id)
    && typeof c.text === "string" && !!c.text.trim() && c.text.length <= maxCommentLength
    && typeof c.quote === "string" && !!c.quote.trim() && c.quote.length <= maxQuoteLength
    && typeof c.before === "string" && c.before.length <= contextLength
    && typeof c.after === "string" && c.after.length <= contextLength
    && (c.from === null || Number.isSafeInteger(c.from) && c.from >= 0);
}

function contextScore(body: string, comment: TextComment, from: number): number {
  let left = 0, right = 0;
  const end = from + comment.quote.length;
  while (left < comment.before.length && from > left && body[from - 1 - left] === comment.before[comment.before.length - 1 - left]) left++;
  while (right < comment.after.length && end + right < body.length && body[end + right] === comment.after[right]) right++;
  return left + right;
}

function relocate(body: string, comment: TextComment, bodyStart: number): TextComment {
  if (comment.from === null) return comment;
  const expected = comment.from;
  if (expected >= bodyStart && body.startsWith(comment.quote, expected)
    && body.slice(Math.max(0, expected - comment.before.length), expected) === comment.before
    && body.slice(expected + comment.quote.length, expected + comment.quote.length + comment.after.length) === comment.after) return comment;

  let best = -1, score = -1, tied = false, matches = 0;
  for (let at = body.indexOf(comment.quote, bodyStart); at >= 0; at = body.indexOf(comment.quote, at + 1)) {
    matches++;
    const next = contextScore(body, comment, at);
    if (next > score) { best = at; score = next; tied = false; }
    else if (next === score) tied = true;
  }
  if (best < 0 || score < Math.min(8, comment.before.length + comment.after.length) || matches > 1 && tied) return { ...comment, from: null };
  return { ...comment, ...anchorTextComment(body, best, best + comment.quote.length) };
}

export function resolveTextComments(body: string, comments: readonly TextComment[]): TextComment[] {
  const bodyStart = frontmatterRange(body)?.end ?? 0;
  return comments.map(comment => relocate(body, comment, bodyStart));
}

export function splitTextComments(source: string): { body: string; comments: TextComment[] } {
  if (!source.includes("<!-- nebula-text-comments:v1 ")) return { body: source, comments: [] };
  const matches = source.matchAll(trailer);
  const match = matches.next().value;
  if (!match || !matches.next().done) return { body: source, comments: [] };
  try {
    const records: unknown = JSON.parse(decodeURIComponent(match[1]!));
    if (!Array.isArray(records) || !records.every(isTextComment)
      || new Set(records.map(comment => comment.id)).size !== records.length) return { body: source, comments: [] };
    const suffix = source.slice(match.index + match[0].length);
    const boundary = suffix ? match[0].slice(0, match[0].indexOf("<")) : "";
    const body = source.slice(0, match.index) + boundary + suffix;
    const normalized = body.replace(/\r\n?/g, "\n");
    return { body, comments: resolveTextComments(normalized, records) };
  } catch {
    return { body: source, comments: [] };
  }
}

export function joinTextComments(body: string, comments: readonly TextComment[]): string {
  if (!comments.length) return body;
  // The payload cannot contain an HTML comment terminator or a physical newline.
  const payload = encodeURIComponent(JSON.stringify(comments)).replaceAll("-", "%2D");
  return `${body}\n\n<!-- nebula-text-comments:v1 ${payload} -->\n`;
}

export function validCommentRange(body: string, from: number, to: number): boolean {
  return from >= 0 && to <= body.length && to > from && to - from <= maxQuoteLength && !!body.slice(from, to).trim();
}

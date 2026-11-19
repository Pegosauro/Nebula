export const codeModes = [
  ["", "Automatico"], ["text", "Testo"], ["vba", "VBA"], ["excel", "Formula Excel"],
] as const;
export type CodeMode = typeof codeModes[number][0];
type CodeLanguage = "text" | "vba" | "excel";
type TokenStyle = "keyword" | "comment" | "string" | "number" | "reference";
export type CodeToken = { from: number; to: number; style: TokenStyle };

export function codeMode(info: string): string {
  const name = info.trim().split(/\s+/, 1)[0]!.toLowerCase();
  if (/^(?:vb|visualbasic)$/.test(name)) return "vba";
  if (/^(?:excel-formula|xlsx)$/.test(name)) return "excel";
  if (/^(?:plain|plaintext|txt)$/.test(name)) return "text";
  return name;
}

export function codeLanguage(info: string, source: string): CodeLanguage {
  const mode = codeMode(info);
  if (mode) return mode === "vba" || mode === "excel" ? mode : "text";
  if (/^\s*=\s*(?:[\w.$'"([+\-@#]|\p{L})/u.test(source)) return "excel";
  const start = source.split("\n").find(line => !/^\s*(?:'|Rem\b|$)/i.test(line)) ?? "";
  return /^\s*(?:(?:Public|Private|Friend|Static)\s+)*(?:(?:Sub|Function|Property\s+(?:Get|Let|Set))\s+[a-z_]\w*|Option\s+(?:Explicit|Base|Compare)\b|Attribute\s+VB_\w+\b)/i.test(start) ? "vba" : "text";
}

export function codeLabel(mode: string, language: CodeLanguage) {
  return codeModes.find(([id]) => id === (mode || language))?.[1] ?? mode;
}

export const fenceOpening = /^( {0,3})(`{3,}(?!`)|~{3,}(?!~))([^\n]*)$/;

export function fencedPayload(raw: string): string | undefined {
  const lines = raw.split("\n");
  const opening = fenceOpening.exec(lines.shift() ?? "");
  if (!opening || (opening[2]![0] === "`" && opening[3]!.includes("`"))) return;
  const marker = opening[2]!;
  const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \t]*$`);
  const end = lines.findIndex(line => closing.test(line));
  if (end >= 0) lines.length = end;
  const indent = opening[1]!.length;
  return lines.map(line => indent ? line.replace(new RegExp(`^ {0,${indent}}`), "") : line).join("\n");
}

const vbaKeywords = new Set("and as boolean byref byte byval call case class const currency date declare dim do double each else elseif empty end enum eqv erase error event exit false for friend function get global gosub goto if imp implements in integer is let lib like long longlong longptr loop me mod new next not nothing null object on option optional or paramarray preserve private property public raiseevent redim resume return select set single static step stop string sub then to true type typeof until variant wend while with withevents xor".split(" "));
const vbaLex = /"(?:[^"\n]|"")*"|'[^\n]*|\bRem(?:[ \t][^\n]*)?(?=$|\n)|\b\d+(?:\.\d+)?\b|\b[a-z_]\w*/gi;
const excelLex = /"(?:[^"\n]|"")*"|'(?:[^'\n]|'')*'|\[[^\[\]\n]*\]|\$?[a-z]{1,3}\$?\d+(?![\p{L}\w.!(])|[\p{L}_][\p{L}\w.]*\s*(?=\()|\b\d+(?:[.,]\d+)?(?:e[+-]?\d+)?\b/giu;

export function codeTokens(source: string, language: CodeLanguage): CodeToken[] {
  if (language === "text") return [];
  const tokens: CodeToken[] = [];
  for (const match of source.matchAll(language === "vba" ? vbaLex : excelLex)) {
    const value = match[0], first = value[0]!;
    let style: TokenStyle;
    if (first === '"') style = "string";
    else if (language === "vba" && (first === "'" || /^Rem\b/i.test(value))) style = "comment";
    else if (/^\d/.test(first)) style = "number";
    else if (language === "excel") style = source[match.index + value.length] === "("
      ? "keyword" : "reference";
    else if (vbaKeywords.has(value.toLowerCase())) style = "keyword";
    else continue;
    tokens.push({ from: match.index, to: match.index + value.trimEnd().length, style });
  }
  return tokens;
}

export function indentVba(source: string): string {
  const stack: string[] = [];
  const lines = source.split("\n");
  const result: string[] = [];
  for (const raw of lines) {
    const body = raw.trimStart();
    const statement = body.replace(/"(?:[^"]|"")*"|'[^\n]*|^Rem\b.*$/gi, " ").trim().toLowerCase();
    // Keep uncertain constructs intact, including continued and compound statements.
    if (/(?:^#|:[^=]|:$|\s_$)/.test(statement)) return source;
    const end = /^(?:end\s+(sub|function|property|if|select|with|type|enum)|\b(next|loop|wend)\b)/.exec(statement);
    const expected = end?.[1] ?? ({ next: "for", loop: "do", wend: "while" } as Record<string, string>)[end?.[2] ?? ""];
    if (expected === "select" && stack.at(-1) === "case") stack.pop();
    if (expected && stack.pop() !== expected) return source;

    const branch = /^(elseif|else|case)\b/.exec(statement)?.[1];
    if (branch === "case") {
      if (stack.at(-1) === "case") stack.pop();
      if (stack.at(-1) !== "select") return source;
    } else if (branch && stack.at(-1) !== "if") return source;

    const depth = stack.length - Number(branch === "elseif" || branch === "else");
    result.push(body ? "    ".repeat(depth) + body : raw);
    if (expected) continue;
    if (branch === "case") { stack.push("case"); continue; }
    if (branch) continue;

    const start = /^(?:(?:public|private|friend|static)\s+)*(sub|function|property|for|do|while|with|type|enum)\b/.exec(statement)?.[1];
    if (start) stack.push(start);
    else if (/^select\s+case\b/.test(statement)) stack.push("select");
    else if (/^if\b.*\bthen\s*$/.test(statement)) stack.push("if");
  }
  return stack.length ? source : result.join("\n");
}

export function excelBreaks(source: string): Array<{ at: number; indent: number }> {
  const breaks = new Map<number, number>();
  if (!/^\s*=/.test(source) || source.includes("\n")) return [];
  // Quoted strings, quoted sheet names and structured references can contain separators.
  const tokens = Array.from(source.matchAll(/"(?:[^"]|"")*"|'(?:[^']|'')*'|[()[\]{},;]/g));
  let containerDepth = 0;
  const italian = tokens.some(({ 0: char }) => {
    if (char === "[" || char === "{") containerDepth++;
    if (char === "]" || char === "}") containerDepth--;
    return !containerDepth && char === ";";
  });
  let depth = 0, protectedDepth = 0;
  for (const [index, token] of tokens.entries()) {
    const char = token[0], at = token.index;
    if (char === "[" || char === "{") { protectedDepth++; continue; }
    if (char === "]" || char === "}") { protectedDepth--; continue; }
    if (protectedDepth !== 0) continue;
    if (char === "(") {
      depth++;
      const next = tokens[index + 1];
      if (next?.[0] !== ")" || source.slice(at + 1, next.index).trim()) breaks.set(at + 1, depth);
    } else if (char === ")") {
      if (--depth < 0) return [];
      const previous = tokens[index - 1];
      if (previous?.[0] !== "(" || source.slice(previous.index + 1, at).trim()) breaks.set(at, depth);
    } else if (depth && (char === ";" || (char === "," && !italian && !(/\d/.test(source[at - 1] ?? "") && /\d/.test(source[at + 1] ?? ""))))) {
      breaks.set(at + 1, depth);
    }
  }
  if (depth !== 0 || protectedDepth !== 0) return [];
  return Array.from(breaks, ([at, indent]) => ({ at, indent: Math.min(indent, 16) }));
}

export function formatExcelDisplay(source: string): string {
  const breaks = excelBreaks(source);
  let output = "", previous = 0;
  for (const { at, indent } of breaks) {
    output += source.slice(previous, at).trim() + "\n" + "    ".repeat(indent);
    previous = at;
  }
  return output + (breaks.length ? source.slice(previous).trimStart() : source);
}

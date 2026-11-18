import { isPaletteColor, paletteColors, type PaletteColor } from "./colorPalette";

const emojiColors: Partial<Record<PaletteColor, { name: string; prefix: string }>> = {
  "#22c55e": { name: "green", prefix: "🟢" },
  "#facc15": { name: "yellow", prefix: "🟡" },
  "#f97316": { name: "orange", prefix: "🟠" },
  "#ef4444": { name: "red", prefix: "🔴" },
  "#8b5cf6": { name: "purple", prefix: "🟣" },
  "#3b82f6": { name: "blue", prefix: "🔵" },
};

export const highlightColors = paletteColors.map(({ name, color }) => ({
  name: emojiColors[color]?.name ?? color,
  label: name,
  color,
  prefix: emojiColors[color]?.prefix ?? `{${color}}`,
}));

export type HighlightColor = (typeof highlightColors)[number];
const highlightsByName = new Map(highlightColors.map(color => [color.name, color]));
const highlightsByPrefix = new Map(highlightColors.flatMap(color => [[color.prefix, color], [`{${color.color}}`, color]] as const));
export const defaultHighlightColor = highlightsByName.get("yellow")!;
export const highlightPattern = /^==([^=\n](?:[^\n]*?[^=\n])?)==/;
const inlineHighlights = new RegExp(highlightPattern.source.slice(1), "g");
const legacyPrefix = /^[🟢🟡🟠🔴🟣🔵]/u;
const palettePrefix = /^\{(#[\da-f]{6})\}/;

export function highlightColorNamed(name: string) {
  return highlightsByName.get(name);
}

export function splitHighlight(content: string) {
  const hex = palettePrefix.exec(content);
  const prefix = hex && isPaletteColor(hex[1]!) ? hex[0] : legacyPrefix.exec(content)?.[0];
  const color = prefix && content.length > prefix.length ? highlightsByPrefix.get(prefix) : undefined;
  const prefixLength = color ? prefix!.length : 0;
  return { color: color ?? defaultHighlightColor, prefixLength, text: content.slice(prefixLength) };
}

export function* findHighlights(text: string, offset = 0) {
  for (const match of text.matchAll(inlineHighlights)) {
    const index = match.index!;
    let before = index;
    while (before > 0 && text[before - 1] === "\\") before--;
    if ((index - before) % 2) continue;
    const from = offset + index;
    const to = from + match[0].length;
    const { color, prefixLength } = splitHighlight(match[1]!);
    yield { from, to, prefixFrom: from + 2, textFrom: from + 2 + prefixLength, textTo: to - 2, color };
  }
}

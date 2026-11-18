import { paletteColors, type PaletteColor } from "./colorPalette";

export interface HighlightColor { name: string; label: string; prefix: string; hex?: PaletteColor }

export const highlightColors: HighlightColor[] = [
  { name: "green", label: "Verde", prefix: "🟢" },
  { name: "yellow", label: "Giallo", prefix: "🟡" },
  { name: "orange", label: "Arancione", prefix: "🟠" },
  { name: "red", label: "Rosso", prefix: "🔴" },
  { name: "purple", label: "Viola", prefix: "🟣" },
  { name: "blue", label: "Blu", prefix: "🔵" },
];

export const defaultHighlightColor = highlightColors[1]!;
export const highlightPattern = /^==([^=\n](?:[^\n]*?[^=\n])?)==/;
const inlineHighlights = new RegExp(highlightPattern.source.slice(1), "g");

// Read shades saved by earlier versions without offering them in the editor.
const savedShades = new Map(paletteColors.map(({ name, color }): [string, HighlightColor] => [
  `{${color}}`, { name: color, label: name, prefix: `{${color}}`, hex: color },
]));

export function splitHighlight(content: string) {
  const hexPrefix = /^\{(#[\da-f]{6})\}/.exec(content)?.[0];
  const color = hexPrefix
    ? savedShades.get(hexPrefix)
    : highlightColors.find(option => content.startsWith(option.prefix));
  const selected = color && content.length > color.prefix.length ? color : undefined;
  const prefixLength = selected?.prefix.length ?? 0;
  return { color: selected ?? defaultHighlightColor, prefixLength, text: content.slice(prefixLength) };
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

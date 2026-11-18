export const highlightColors = [
  { name: "green", label: "Verde", emoji: "🟢" },
  { name: "yellow", label: "Giallo", emoji: "🟡" },
  { name: "orange", label: "Arancione", emoji: "🟠" },
  { name: "red", label: "Rosso", emoji: "🔴" },
  { name: "purple", label: "Viola", emoji: "🟣" },
  { name: "blue", label: "Blu", emoji: "🔵" },
] as const;

export type HighlightColor = (typeof highlightColors)[number];
export const defaultHighlightColor = highlightColors[1];
export const highlightPattern = /^==([^=\n](?:[^\n]*?[^=\n])?)==/;
const inlineHighlights = new RegExp(highlightPattern.source.slice(1), "g");

export function splitHighlight(content: string) {
  const color = highlightColors.find(option => content.length > option.emoji.length && content.startsWith(option.emoji));
  const emojiLength = color?.emoji.length ?? 0;
  return { color: color ?? defaultHighlightColor, emojiLength, text: content.slice(emojiLength) };
}

export function* findHighlights(text: string, offset = 0) {
  for (const match of text.matchAll(inlineHighlights)) {
    const index = match.index!;
    let before = index;
    while (before > 0 && text[before - 1] === "\\") before--;
    if ((index - before) % 2) continue;
    const from = offset + index;
    const to = from + match[0].length;
    const { color, emojiLength } = splitHighlight(match[1]!);
    yield { from, to, emojiFrom: from + 2, textFrom: from + 2 + emojiLength, textTo: to - 2, color };
  }
}

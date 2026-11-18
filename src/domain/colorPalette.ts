const shades = ["chiarissimo", "chiaro", "medio", "", "scuro"] as const;

export const paletteRows = [
  { name: "Rosso", colors: ["#fee2e2", "#fecaca", "#fca5a5", "#ef4444", "#991b1b"] },
  { name: "Arancione", colors: ["#ffedd5", "#fed7aa", "#fdba74", "#f97316", "#9a3412"] },
  { name: "Giallo", colors: ["#fef9c3", "#fde68a", "#facc15", "#ca8a04", "#713f12"] },
  { name: "Verde", colors: ["#dcfce7", "#bbf7d0", "#86efac", "#22c55e", "#166534"] },
  { name: "Blu", colors: ["#dbeafe", "#bfdbfe", "#93c5fd", "#3b82f6", "#1e3a8a"] },
  { name: "Viola", colors: ["#f3e8ff", "#e9d5ff", "#c084fc", "#8b5cf6", "#4c1d95"] },
  { name: "Bianco/Nero", colors: ["#ffffff", "#e5e7eb", "#9ca3af", "#374151", "#111827"] },
] as const;

export type PaletteColor = (typeof paletteRows)[number]["colors"][number];
const yellowNames = ["Giallo chiarissimo", "Giallo chiaro", "Giallo", "Giallo ocra", "Giallo scuro"];
const neutralNames = ["Bianco", "Grigio chiaro", "Grigio medio", "Grigio scuro", "Nero"];

export function paletteColorName(row: (typeof paletteRows)[number], index: number) {
  if (row.name === "Bianco/Nero") return neutralNames[index]!;
  if (row.name === "Giallo") return yellowNames[index]!;
  return `${row.name} ${shades[index]}`.trimEnd();
}

export const paletteColors = paletteRows.flatMap(row => row.colors.map((color, index) => ({ name: paletteColorName(row, index), color })));
const paletteValues: ReadonlySet<string> = new Set(paletteColors.map(entry => entry.color));

export function isPaletteColor(color: string): color is PaletteColor {
  return paletteValues.has(color);
}

function rgb(color: string) {
  return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
}
function luminance(channels: number[]) {
  const linear = channels.map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
}
export function textOnColor(color: string) {
  return luminance(rgb(color)) > .179 ? "#000000" : "#ffffff";
}

export function accentInk(color: string, background: string) {
  const base = rgb(color), surface = luminance(rgb(background));
  const endpoint = surface > .179 ? 0 : 255;
  for (let step = 0; step <= 20; step++) {
    const candidate = base.map(channel => Math.round(channel + (endpoint - channel) * step / 20));
    const value = luminance(candidate);
    if ((Math.max(value, surface) + .05) / (Math.min(value, surface) + .05) >= 4.5) {
      return "#" + candidate.map(channel => channel.toString(16).padStart(2, "0")).join("");
    }
  }
  return endpoint === 0 ? "#000000" : "#ffffff";
}

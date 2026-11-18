import { accentInk, isPaletteColor } from "../../domain/colorPalette";
import type { CSSProperties } from "react";
import type { CategoryTextStyle } from "./model";

export function categoryNameStyle(style?: CategoryTextStyle, categoryColor?: string): CSSProperties {
  const color = style?.categoryColor ? categoryColor : undefined;
  return {
    color: color && isPaletteColor(color) ? `light-dark(${accentInk(color, "#f5f6f8")}, ${accentInk(color, "#1d2230")})` : color,
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecorationLine: [style?.underline ? "underline" : "", style?.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
  };
}

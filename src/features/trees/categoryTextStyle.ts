import type { CSSProperties } from "react";
import type { CategoryTextStyle } from "./model";

export function categoryNameStyle(style?: CategoryTextStyle, categoryColor?: string): CSSProperties {
  return {
    color: style?.categoryColor ? categoryColor : undefined,
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecorationLine: [style?.underline ? "underline" : "", style?.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
  };
}

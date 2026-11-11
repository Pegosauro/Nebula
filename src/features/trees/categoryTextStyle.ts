import type { CSSProperties } from "react";
import type { CategoryTextStyle } from "./model";

export function categoryNameStyle(style?: CategoryTextStyle): CSSProperties {
  return {
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecorationLine: [style?.underline ? "underline" : "", style?.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
  };
}

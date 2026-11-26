import type { TextButtonIcon } from "../../domain/textButtons";

const icons = import.meta.glob<string>("./text-button-icons/*.svg", {
  eager: true, import: "default", query: "?url",
});

export function textButtonIconMask(icon?: TextButtonIcon): string | undefined {
  const source = icon && icons[`./text-button-icons/${icon}.svg`];
  return source ? `url(${JSON.stringify(source)})` : undefined;
}

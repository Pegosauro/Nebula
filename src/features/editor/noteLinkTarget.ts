import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";

export const noteLinkSelector = "[data-live-target],[data-nebula-target],[data-live-href],a[href]";
export function noteLinkTarget(element: HTMLElement, sourcePath: string): string | undefined {
  const target = element.dataset.liveTarget ?? element.dataset.nebulaTarget;
  if (target) return target;
  const href = element.dataset.liveHref ?? element.getAttribute("href") ?? "";
  if (!/(?:\.md|\.config\.json)(?:#|$)/i.test(href) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return;
  try { return resolveImagePath(sourcePath, href.split("#")[0]!).replace(/\.md$/i, ""); } catch { return; }
}

export function renderedLinkHref(value: string): string {
  if (/^www\./i.test(value)) return `https://${value}`;
  if (/^[^\s:@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  return value;
}

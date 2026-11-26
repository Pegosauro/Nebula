import { WidgetType } from "@codemirror/view";
import {
  defaultExternalLinkAppearance, externalLinkIcons, externalLinkTitle, externalWebUrl,
  type ExternalLinkDraft, type ExternalLinkIcon,
} from "../../domain/externalLinks";
import type { ExternalLinkMenu } from "./externalLinkEditing";
import external from "./external-link-icons/link-esterno.svg?url";
import pdf from "./external-link-icons/pdf.svg?url";
import excel from "./external-link-icons/excel.svg?url";
import word from "./external-link-icons/word.svg?url";
import powerpoint from "./external-link-icons/powerpoint.svg?url";
import folder from "./external-link-icons/cartella.svg?url";
import image from "./external-link-icons/immagine.svg?url";
import video from "./external-link-icons/video.svg?url";
import zip from "./external-link-icons/archivio-zip.svg?url";
import download from "./external-link-icons/download.svg?url";

const iconUrls: Record<ExternalLinkIcon, string> = {
  "link-esterno": external, pdf, excel, word, powerpoint, cartella: folder, immagine: image, video, "archivio-zip": zip, download,
};

export function externalIconMask(icon: ExternalLinkIcon): string {
  return `url(${JSON.stringify(iconUrls[icon])})`;
}

function span(doc: Document, className: string, text?: string): HTMLSpanElement {
  const element = doc.createElement("span");
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function fillExternalLinkCard(root: HTMLElement, label: string, url: URL, appearance = defaultExternalLinkAppearance(url), titleNodes?: Node[]) {
  const doc = root.ownerDocument;
  root.dataset.tone = appearance.tone;
  const icon = span(doc, "external-link-glyph");
  icon.setAttribute("aria-hidden", "true");
  icon.style.setProperty("--external-link-mask", externalIconMask(appearance.icon));
  const caption = span(doc, "external-link-caption");
  const name = span(doc, "external-link-name", label);
  if (titleNodes) name.replaceChildren(...titleNodes);
  const info = span(doc, "external-link-domain", [url.hostname, appearance.icon === "link-esterno" ? "" : externalLinkIcons[appearance.icon]].filter(Boolean).join(" · "));
  caption.append(name, info);
  const svgNamespace = "http://www.w3.org/2000/svg";
  const arrow = doc.createElementNS(svgNamespace, "svg");
  arrow.setAttribute("class", "external-link-arrow");
  arrow.setAttribute("viewBox", "0 0 24 24");
  arrow.setAttribute("aria-hidden", "true");
  const arrowPath = doc.createElementNS(svgNamespace, "path");
  arrowPath.setAttribute("d", "M7 17 17 7M7 7h10v10");
  arrow.append(arrowPath);
  root.replaceChildren(icon, caption, arrow);
}

function linkAnchor(doc: Document, draft: ExternalLinkDraft, url: URL) {
  const link = doc.createElement("a");
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "external-link-card-body";
  link.setAttribute("aria-label", draft.label);
  fillExternalLinkCard(link, draft.label, url, draft.appearance);
  return link;
}

export class ExternalLinkWidget extends WidgetType {
  constructor(readonly link: ExternalLinkMenu["link"], readonly onEdit?: (target: ExternalLinkMenu) => void) { super(); }
  eq(other: ExternalLinkWidget) {
    return this.link.from === other.link.from && this.link.raw === other.link.raw && this.onEdit === other.onEdit;
  }
  toDOM(view: import("@codemirror/view").EditorView) {
    const doc = view.dom.ownerDocument;
    const root = span(doc, "external-link-card live-external-link");
    const { draft } = this.link;
    const anchor = linkAnchor(doc, draft, externalWebUrl(draft.address)!);
    root.append(anchor);
    if (!this.onEdit) return root;
    const edit = () => this.onEdit?.({ link: this.link, anchor: root.getBoundingClientRect() });
    root.addEventListener("contextmenu", event => { event.preventDefault(); edit(); });
    anchor.addEventListener("keydown", event => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault(); edit();
    });
    anchor.addEventListener("click", event => { if (event.altKey) { event.preventDefault(); edit(); } });
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "external-link-edit";
    button.textContent = "⋯";
    button.setAttribute("aria-label", `Modifica collegamento: ${draft.label}`);
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", edit);
    root.append(button);
    return root;
  }
}

function emptyLineSide(anchor: Element, previous: boolean): boolean {
  const step = previous ? "previousSibling" : "nextSibling";
  for (let node = anchor[step]; node; node = node[step]) {
    if (node.nodeType === Node.COMMENT_NODE) continue;
    if (node instanceof HTMLBRElement) return true;
    if (!(node instanceof Text)) return false;
    const rows = node.data.split("\n");
    if ((previous ? rows.at(-1) : rows[0])?.trim()) return false;
    if (rows.length > 1) return true;
  }
  return true;
}

export function decorateExternalLinkCards(container: HTMLElement) {
  // Evaluate all physical lines before changing any of the paragraph's nodes.
  const links = [...container.querySelectorAll<HTMLAnchorElement>(":scope > p > a[href]")].filter(anchor =>
    !anchor.dataset.nebulaTarget && !anchor.querySelector("img,[data-nebula-image]") && externalWebUrl(anchor.getAttribute("href") ?? "") && emptyLineSide(anchor, true) && emptyLineSide(anchor, false),
  );
  for (const anchor of links) {
    const url = externalWebUrl(anchor.getAttribute("href") ?? "")!;
    const { appearance } = externalLinkTitle(anchor.dataset.nebulaLinkAppearance ?? "");
    const root = span(container.ownerDocument, "external-link-card");
    const label = anchor.textContent?.trim() || url.hostname;
    const titleNodes = anchor.textContent?.trim() ? [...anchor.childNodes] : undefined;
    anchor.classList.add("external-link-card-body");
    anchor.setAttribute("aria-label", label);
    fillExternalLinkCard(anchor, label, url, appearance, titleNodes);
    anchor.before(root);
    root.append(anchor);
  }
}

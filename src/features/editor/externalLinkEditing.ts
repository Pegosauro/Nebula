import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { Lexer, Parser } from "marked";
import { externalLinkTitle, externalLinkTitleSuffix, externalWebUrl, type ExternalLinkDraft } from "../../domain/externalLinks";
import { renderedLinkHref } from "./noteLinkTarget";

const labelParser = new Parser();

type ExternalLinkSource = {
  from: number;
  to: number;
  raw: string;
  rawLabel?: string;
  labelRange?: { from: number; to: number };
  rawDestination: string;
  rawTitle?: string;
  standalone: boolean;
  draft: ExternalLinkDraft;
};
export type ExternalLinkMenu = { link: ExternalLinkSource; anchor: DOMRect };

function markdownUnescape(value: string): string {
  return value.replace(/\\([!-/:-@[-`{-~])/gu, "$1").replace(/&amp;/giu, "&");
}

export function editorExternalLink(state: EditorState, node: SyntaxNode): ExternalLinkSource | undefined {
  const name = node.name;
  if (name === "URL" && ["Link", "Autolink", "Image"].includes(node.parent?.name ?? "")) return;
  const url = name === "URL" ? node : ["Link", "Autolink"].includes(name) ? node.getChild("URL") : null;
  if (!url) return;
  const rawDestination = state.sliceDoc(url.from, url.to);
  const address = renderedLinkHref(markdownUnescape(rawDestination.replace(/^<(.*)>$/u, "$1")));
  if (!externalWebUrl(address)) return;
  const line = state.doc.lineAt(node.from);
  const standalone = node.parent?.name === "Paragraph" && node.parent.parent?.name === "Document" && node.to <= line.to && !node.getChild("Image")
    && !state.sliceDoc(line.from, node.from).trim() && !state.sliceDoc(node.to, line.to).trim();
  const closeLabel = name === "Link" ? node.getChildren("LinkMark")[1] : undefined;
  const labelRange = closeLabel ? { from: node.from + 1, to: closeLabel.from }
    : name === "Autolink" ? { from: url.from, to: url.to } : undefined;
  const rawLabel = closeLabel && state.sliceDoc(node.from + 1, closeLabel.from);
  const label = rawLabel ? labelParser.parseInline(Lexer.lexInline(rawLabel), labelParser.textRenderer) : address;
  const title = node.getChild("LinkTitle");
  const rawTitle = title && state.sliceDoc(title.from, title.to);
  const appearance = rawTitle ? externalLinkTitle(rawTitle.slice(1, -1)).appearance : undefined;
  return {
    from: node.from, to: node.to, raw: state.sliceDoc(node.from, node.to),
    rawLabel, labelRange, rawDestination, rawTitle: rawTitle || undefined, standalone,
    draft: { label, address, appearance },
  };
}

export function externalLinkAt(state: EditorState, from: number): ExternalLinkSource | undefined {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(from, 1); node; node = node.parent) {
    if (node.from !== from) return;
    const link = editorExternalLink(state, node);
    if (link) return link;
  }
}

export function externalLinkReplacement(state: EditorState, original: ExternalLinkSource, draft: ExternalLinkDraft): string | undefined {
  if (state.readOnly || state.sliceDoc(original.from, original.to) !== original.raw) return;
  const current = externalLinkAt(state, original.from);
  const url = externalWebUrl(draft.address);
  const label = draft.label.trim();
  if (!current || current.to !== original.to || current.standalone !== original.standalone || !url || !label || /[\r\n]/u.test(label)) return;
  const escapedLabel = label === original.draft.label && original.rawLabel !== undefined
    ? original.rawLabel : label.replace(/[\\[\]*_`~<>!&]/gu, "\\$&");
  const destination = draft.address === original.draft.address && original.rawLabel !== undefined
    ? original.rawDestination : `<${url.href.replace(/[<>\\]/gu, character => encodeURIComponent(character))}>`;
  const originalTitle = original.rawTitle;
  const tooltip = originalTitle ? externalLinkTitle(originalTitle.slice(1, -1)).tooltip : "";
  const appearance = (current.standalone ? draft.appearance : undefined) ?? original.draft.appearance;
  const titleText = [tooltip, appearance && externalLinkTitleSuffix(appearance)].filter(Boolean).join(" ");
  const title = titleText ? ` ${originalTitle?.[0] ?? '"'}${titleText}${originalTitle?.at(-1) ?? '"'}` : "";
  return `[${escapedLabel}](${destination}${title})`;
}

import { deleteAroundHiddenSyntax } from "./hiddenSyntaxEditing";
import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { analyzeMarkdown, type MarkdownAnalysis } from "./markdownAnalysis";
import { vaultService } from "../vault/vaultService";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { Facet, Prec, StateField, type EditorState, type Range } from "@codemirror/state";
import { resolveKnowledgeTarget } from "../../domain/resolveKnowledge";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { headingEntries, type MarkdownTable } from "./markdownTools";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { renderedLinkHref } from "./noteLinkTarget";
import { parseWikilinks } from "../../infrastructure/markdown/parseKnowledge";
import { undo, redo, isolateHistory } from "@codemirror/commands";
import { InlineTable } from "./inlineTable";

const inlineTables = new WeakMap<HTMLElement, InlineTable>();

// A selection is a reading/formatting gesture, never a request to expose source.
export const revealMarkdownAtCursor = Facet.define<boolean, boolean>({ combine: values => values[0] ?? true });

export function revealsSyntax(state: EditorState, from: number, to: number): boolean {
  return state.facet(revealMarkdownAtCursor) && !state.readOnly && state.selection.ranges.every(range => range.empty) &&
    state.selection.ranges.some(range => range.head >= from && range.head <= to);
}
class LabelWidget extends WidgetType {
  constructor(readonly text: string, readonly className: string) { super(); }
  eq(other: LabelWidget) { return this.text === other.text && this.className === other.className; }
  toDOM() { const span = document.createElement("span"); span.className = this.className; span.textContent = this.text; return span; }
  ignoreEvent() { return false; }
}
class TableWidget extends WidgetType {
  private images: ImageWidget[] = [];
  constructor(readonly table: MarkdownTable, readonly raw: string, readonly edit: (table: MarkdownTable) => void, readonly sourcePath: string, readonly openLink: (target: string) => void, readonly readOnly: boolean) { super(); }
  eq(other: TableWidget) { return this.raw === other.raw && this.table.from === other.table.from && this.edit === other.edit && this.readOnly === other.readOnly; }
  updateDOM(dom: HTMLElement) {
    const inline = inlineTables.get(dom);
    if (!inline || this.readOnly) return false;
    inline.sync(this.table, this.raw); return true;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div"); wrap.className = "live-table markdown-preview";
    if (this.readOnly) wrap.innerHTML = renderMarkdownSafe(this.raw, navigationKnowledge());
    wrap.addEventListener("click", event => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a"); if (!link) return;
      if (link.dataset.nebulaTarget) { event.preventDefault(); this.openLink(link.dataset.nebulaTarget); return; }
      const href = link.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) return;
      event.preventDefault();
      try {
        if (/(?:\.md|\.config\.json)(?:#|$)/i.test(href)) this.openLink(resolveImagePath(this.sourcePath, href.split("#")[0]!).replace(/\.md$/i, ""));
        else if (href.startsWith("#")) {
          const name = decodeURIComponent(href.slice(1)).replaceAll("-", " ").toLocaleLowerCase();
          const heading = headingEntries(view.state.doc.toString()).find(item => item.text.toLocaleLowerCase() === name);
          if (heading) { view.dispatch({ selection: { anchor: heading.from }, scrollIntoView: true }); view.focus(); }
        }
      } catch { /* Invalid relative path or anchor. */ }
    });
    const decorate = (host: HTMLElement) => {
      this.images.forEach(image => image.destroy()); this.images = [];
      host.querySelectorAll<HTMLElement>("[data-nebula-image]").forEach(placeholder => {
        const widget = new ImageWidget(this.sourcePath, placeholder.dataset.nebulaImage!, placeholder.getAttribute("aria-label") ?? "");
        this.images.push(widget); placeholder.replaceWith(widget.toDOM(view));
      });
    };
    if (!this.readOnly) inlineTables.set(wrap, new InlineTable(wrap, this.table, this.raw, {
      change: (table, text, isolate) => { if (!view.state.readOnly) view.dispatch({ changes: { from: table.from, to: table.to, insert: text }, userEvent: "input.table", ...(isolate ? { annotations: isolateHistory.of(isolate) } : {}) }); },
      history: forward => { if (!view.state.readOnly) (forward ? redo : undo)(view); },
      decorate, measure: () => view.requestMeasure(), dispose: () => this.images.forEach(image => image.destroy()),
    }));
    else decorate(wrap);
    return wrap;
  }
  destroy(dom: HTMLElement) { const inline = inlineTables.get(dom); if (inline) { inline.destroy(); inlineTables.delete(dom); } else this.images.forEach(image => image.destroy()); }
  ignoreEvent() { return true; }
}


class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number, readonly readOnly: boolean) { super(); }
  eq(other: TaskWidget) { return other.checked === this.checked && other.from === this.from && other.readOnly === this.readOnly; }
  toDOM(view: EditorView) {
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = this.checked; input.disabled = this.readOnly;
    input.className = "live-task"; input.setAttribute("aria-label", this.checked ? "Segna attività da fare" : "Completa attività");
    input.addEventListener("mousedown", event => event.preventDefault());
    input.addEventListener("change", () => { if (view.state.readOnly) { input.checked = this.checked; return; } view.dispatch({ changes: { from: this.from + 1, to: this.from + 2, insert: input.checked ? "x" : " " }, userEvent: "input" }); });
    return input;
  }
  ignoreEvent() { return true; }
}
class ImageWidget extends WidgetType {
  private url?: string;
  private disposed = false;
  constructor(readonly sourcePath: string, readonly reference: string, readonly alt: string) { super(); }
  eq(other: ImageWidget) { return other.reference === this.reference && other.sourcePath === this.sourcePath && other.alt === this.alt; }
  toDOM(view: EditorView) {
    const wrap = document.createElement("span"); wrap.className = "live-image";
    const image = document.createElement("img"); image.alt = this.alt; image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => { if (!this.disposed) view.requestMeasure(); });
    image.addEventListener("error", () => { wrap.textContent = `Immagine non disponibile: ${this.alt || this.reference}`; });
    if (/^https?:\/\//i.test(this.reference)) image.src = this.reference;
    else void (async () => {
      try {
        const blob = await vaultService.readImage(resolveImagePath(this.sourcePath, this.reference));
        if (this.disposed) return;
        this.url = URL.createObjectURL(blob); image.src = this.url;
      } catch { if (!this.disposed) wrap.textContent = `Immagine non disponibile: ${this.alt || this.reference}`; }
    })();
    wrap.append(image); return wrap;
  }
  destroy() { this.disposed = true; if (this.url) URL.revokeObjectURL(this.url); }
  ignoreEvent() { return false; }
}
class BulletWidget extends WidgetType {
  toDOM() { const span = document.createElement("span"); span.className = "live-bullet"; span.textContent = "•"; return span; }
  ignoreEvent() { return false; }
}

const headingDigits = [
  "M18.35 12.83 15.6 14.48v-1.99l2.9-1.82h1.78V20h-1.93z",
  "M14.8 13.42c.04-1.77 1.35-2.92 3.31-2.92 1.99 0 3.25 1.07 3.25 2.69 0 1.21-.62 2.03-2.19 3.43l-1.85 1.66v.05h4.16V20h-6.62v-1.48l3.17-2.96c1.05-.99 1.39-1.49 1.39-2.24 0-.69-.52-1.16-1.36-1.16-.85 0-1.42.53-1.44 1.26z",
  "M16.9 14.44h1.02c.91 0 1.46-.46 1.46-1.17 0-.68-.51-1.13-1.38-1.13-.84 0-1.36.44-1.44 1.13h-1.82c.1-1.69 1.37-2.77 3.37-2.77 1.93 0 3.16.94 3.16 2.43 0 1.08-.64 1.83-1.65 2.08v.04c1.24.15 2.02.96 2.02 2.2 0 1.76-1.43 2.92-3.6 2.92-2.07 0-3.42-1.09-3.51-2.85h1.88c.07.72.66 1.18 1.63 1.18.96 0 1.58-.5 1.58-1.25 0-.85-.61-1.29-1.67-1.29H16.9z",
  "M18.67 20v-1.73h-4.32v-1.66l3.79-5.94h2.38v5.96h1.24v1.64h-1.24V20zm-2.52-3.34h2.55v-4.04h-.04z",
];

class HeadingWidget extends WidgetType {
  constructor(readonly level: number) { super(); }
  eq(other: HeadingWidget) { return other.level === this.level; }
  toDOM() {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElement("span");
    icon.className = "live-heading-icon";
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", `Titolo H${this.level}`);
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const bars = document.createElementNS(namespace, "path");
    bars.setAttribute("d", "M3.325 5.325h17.35M3.325 12h5.35M3.325 18.675h5.35");
    bars.setAttribute("fill", "none");
    bars.setAttribute("stroke-width", "2.65");
    bars.setAttribute("stroke-linecap", "round");
    const digit = document.createElementNS(namespace, "path");
    digit.setAttribute("d", headingDigits[this.level - 1]!);
    digit.setAttribute("fill", "currentColor");
    svg.append(bars, digit);
    icon.append(svg);
    return icon;
  }
  ignoreEvent() { return false; }
}

function build(view: EditorView, sourcePath: string, analysis: MarkdownAnalysis): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const metadataEnd = analysis.metadata?.end ?? 0;
  const markers = analysis.markers;
  const hiddenMarker = (from: number, to = from) => markers.some(marker => from >= marker.from && to < marker.to);
  const active = (from: number, to: number) => revealsSyntax(view.state, from, to);
  const hide = (from: number, to: number, owner?: { from: number; to: number }) => { if (to > from) decorations.push(Decoration.replace({ nebulaSyntax: true, nebulaOwner: owner && { from: owner.from, to: owner.to } }).range(from, to)); };
  const addMark = (from: number, to: number, className: string, attributes?: Record<string, string>) => { if (to > from) decorations.push(Decoration.mark({ class: className, attributes }).range(from, to)); };
  const tree = syntaxTree(view.state);
  const documents = navigationKnowledge().documents;
  const inCode = (at: number) => {
    for (let node = tree.resolveInner(at, 1); node; node = node.parent!) if (/Code|Table/.test(node.name)) return true;
    return false;
  };
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({ from, to, enter(node) {
      if (node.to <= metadataEnd || hiddenMarker(node.from, node.to)) return false;
      const name = node.name, parent = node.node.parent;
      if (name === "Table") return false;
      const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
      if (heading) decorations.push(Decoration.line({ class: `live-heading live-h${heading[1]}`, attributes: { "data-heading-from": String(node.from) } }).range(view.state.doc.lineAt(node.from).from));
      if (name === "FencedCode" || name === "CodeBlock") {
        for (let line = view.state.doc.lineAt(node.from); line.from <= node.to; ) {
          if (!hiddenMarker(line.from)) decorations.push(Decoration.line({ class: `live-code-line ${line.from === view.state.doc.lineAt(node.from).from ? "live-block-start" : ""} ${line.to >= node.to ? "live-block-end" : ""}` }).range(line.from));
          if (line.to >= node.to) break; line = view.state.doc.lineAt(line.to + 1);
        }
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (child.name === "CodeMark" || child.name === "CodeInfo") {
            const line = view.state.doc.lineAt(child.from);
            if (!active(line.from, line.to)) hide(child.from, child.to);
          }
        }
        return false;
      }
      if (name === "StrongEmphasis") addMark(node.from, node.to, "live-strong");
      if (name === "Emphasis") addMark(node.from, node.to, "live-emphasis");
      if (name === "Strikethrough") addMark(node.from, node.to, "live-strike");
      if (name === "InlineCode") addMark(node.from, node.to, "live-code");
      if (name === "Blockquote") {
        const callout = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/.exec(view.state.sliceDoc(node.from, node.to));
        for (let line = view.state.doc.lineAt(node.from); line.from <= node.to; ) {
          decorations.push(Decoration.line({ class: `${callout ? `live-callout live-callout-${callout[1]!.toLowerCase()}` : "live-quote-line"} ${line.from === view.state.doc.lineAt(node.from).from ? "live-block-start" : ""} ${line.to >= node.to ? "live-block-end" : ""}` }).range(line.from));
          if (line.to >= node.to) break; line = view.state.doc.lineAt(line.to + 1);
        }
        if (callout) {
          const start = node.from + callout[0].indexOf("[!"), end = node.from + callout[0].length;
          const labels: Record<string, string> = { NOTE: "Nota", TIP: "Suggerimento", IMPORTANT: "Importante", WARNING: "Attenzione", CAUTION: "Avvertenza" };
          if (!active(start, end)) decorations.push(Decoration.replace({ widget: new LabelWidget(labels[callout[1]!]!, "live-callout-label") }).range(start, end));
        }
      }
      if (name === "Autolink" || (name === "URL" && !["Link", "Image"].includes(parent?.name ?? ""))) {
        const url = name === "Autolink" ? node.node.getChild("URL") : node.node;
        if (url) {
          addMark(node.from, node.to, "live-link", { "data-live-href": renderedLinkHref(view.state.sliceDoc(url.from, url.to)), title: "Clic per aprire · Alt+clic per modificare" });
          if (name === "Autolink" && !active(node.from, node.to)) { hide(node.from, url.from, node); hide(url.to, node.to, node); }
        }
        return false;
      }
      if (name === "Link" && node.node.getChild("URL")) {
        const url = node.node.getChild("URL")!;
        addMark(node.from, node.to, "live-link", { "data-live-href": view.state.sliceDoc(url.from, url.to), title: "Clic per aprire · Alt+clic per modificare" });
        if (!active(node.from, node.to)) {
          const marks = node.node.getChildren("LinkMark");
          if (marks.length >= 2) { hide(marks[0]!.from, marks[0]!.to, node); hide(marks[1]!.from, node.to, node); }
        }
      }
      if (name === "Image" && !active(node.from, node.to)) {
        const raw = view.state.sliceDoc(node.from, node.to);
        const match = /^!\[([^\]\n]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)$/.exec(raw);
        if (match && !raw.includes("\n")) {
          decorations.push(Decoration.replace({ widget: new ImageWidget(sourcePath, match[2] || match[3] || "", match[1] || "") }).range(node.from, node.to));
          return false;
        }
      }
      if (name === "HorizontalRule" && !active(node.from, node.to)) {
        decorations.push(Decoration.replace({ widget: new LabelWidget("", "live-divider") }).range(node.from, node.to)); return false;
      }
      // Inline delimiters use their own formatted span; structural markers use only their prefix.
      const extent = ["EmphasisMark", "StrikethroughMark", "CodeMark"].includes(name) ? parent : null;
      if (!active(extent?.from ?? node.from, extent?.to ?? node.to)) {
        if (name === "ListMark" && /^[-+*]$/.test(view.state.sliceDoc(node.from, node.to))) {
          if (/^[-+*]\s+\[[ xX]\]/.test(view.state.sliceDoc(node.from, view.state.doc.lineAt(node.from).to))) hide(node.from, node.to + 1);
          else decorations.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
        }
        if (name === "TaskMarker") decorations.push(Decoration.replace({ widget: new TaskWidget(/x/i.test(view.state.sliceDoc(node.from, node.to)), node.from, view.state.readOnly) }).range(node.from, node.to));
        else if (["HeaderMark", "EmphasisMark", "CodeMark", "StrikethroughMark", "QuoteMark"].includes(name)) {
          const end = ["HeaderMark", "QuoteMark"].includes(name) && view.state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
          const headingPrefix = name === "HeaderMark" && parent?.from === node.from && /^ATXHeading([1-4])$/.exec(parent.name);
          if (headingPrefix) {
            const widget = new HeadingWidget(Number(headingPrefix[1]));
            decorations.push(Decoration.replace({ widget, nebulaSyntax: true }).range(node.from, end));
          } else hide(node.from, end, extent ?? undefined);
        }
      }
    } });
    const text = view.state.sliceDoc(from, to);
    for (const match of text.matchAll(/==([^=\n]+)==/g)) {
      const start = from + match.index!, end = start + match[0].length;
      if (start < metadataEnd || inCode(start)) continue;
      addMark(start, end, "live-highlight");
      if (!active(start, end)) { hide(start, start + 2, { from: start, to: end }); hide(end - 2, end, { from: start, to: end }); }
    }
    for (const link of parseWikilinks(text)) {
      const start = from + link.start, end = from + link.end;
      if (start < metadataEnd || inCode(start)) continue;
      const candidates = resolveKnowledgeTarget(link.target, documents);
      const status = candidates.length === 1 ? "resolved" : candidates.length > 1 ? "ambiguous" : "unresolved";
      addMark(start, end, `live-link live-wikilink is-${status}`, { "data-live-target": link.target, title: `${link.target} · Clic per aprire · Alt+clic per modificare` });
      if (!active(start, end)) {
        const pipe = link.raw.indexOf("|");
        const displayAt = link.raw.indexOf(link.display, 2);
        const labelStart = pipe >= 0 ? pipe + 1 : displayAt >= 2 ? displayAt : 2;
        hide(start, start + labelStart, { from: start, to: end }); hide(end - 2, end, { from: start, to: end });
      }
    }
  }
  return Decoration.set(decorations, true);
}
export function createLiveMarkdown(sourcePath: string, onTable: (table: MarkdownTable) => void = () => {}, onOpenLink: (target: string) => void = () => {}) {
  // Block replacements must be provided directly by state, before viewport measurement.
  const tables = (state: EditorState, analysis: MarkdownAnalysis) => {
    const ranges = analysis.tables.map(({ table, raw }) =>
      Decoration.replace({ block: true, widget: new TableWidget(table, raw, onTable, sourcePath, onOpenLink, state.readOnly) }).range(table.from, table.to));
    for (const marker of analysis.markers) ranges.push(Decoration.replace({ block: true }).range(marker.from, marker.to));
    if (analysis.metadata) ranges.push(Decoration.replace({ block: true }).range(0, analysis.metadata.end));
    return Decoration.set(ranges, true);
  };
  const tableField = StateField.define<{ analysis: MarkdownAnalysis; decorations: DecorationSet }>({
    create: state => { const analysis = analyzeMarkdown(state.doc); return { analysis, decorations: tables(state, analysis) }; },
    update: (value, transaction) => {
      if (!transaction.docChanged && transaction.startState.readOnly === transaction.state.readOnly) return value;
      const analysis = transaction.docChanged ? analyzeMarkdown(transaction.state.doc, value.analysis, transaction.changes, transaction.isUserEvent("input.table")) : value.analysis;
      return { analysis, decorations: tables(transaction.state, analysis) };
    },
    provide: field => [EditorView.decorations.from(field, value => value.decorations), EditorView.atomicRanges.of(view => view.state.field(field).decorations)],
  });
  const inline = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    syntax: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view, sourcePath, view.state.field(tableField).analysis);
      this.syntax = this.decorations.update({ filter: (_from, _to, value) => value.spec.nebulaSyntax === true });
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || update.startState.facet(revealMarkdownAtCursor) !== update.state.facet(revealMarkdownAtCursor) || update.startState.readOnly !== update.state.readOnly || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = build(update.view, sourcePath, update.state.field(tableField).analysis);
        this.syntax = this.decorations.update({ filter: (_from, _to, value) => value.spec.nebulaSyntax === true });
      }
    }
  }, { decorations: value => value.decorations, provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.syntax ?? Decoration.none) });
  const erase = (forward: boolean, word = false) => (view: EditorView) => deleteAroundHiddenSyntax(view, view.plugin(inline)?.syntax ?? Decoration.none, forward, word);
  return [tableField, inline, Prec.high(keymap.of([
    { key: "Backspace", run: erase(false), shift: erase(false) },
    { key: "Delete", run: erase(true) },
    { key: "Mod-Backspace", mac: "Alt-Backspace", run: erase(false, true) },
    { key: "Mod-Delete", mac: "Alt-Delete", run: erase(true, true) },
  ])), EditorView.domEventHandlers({ beforeinput(event, view) {
    if (event.inputType !== "deleteContentBackward" && event.inputType !== "deleteContentForward") return false;
    if (!erase(event.inputType === "deleteContentForward")(view)) return false;
    event.preventDefault(); return true;
  } })];
}

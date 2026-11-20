import { isolateHistory } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { Annotation, type EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { applyImageWidth, imageWidth, titleWithImageWidth } from "../../domain/imageWidth";

export const removedImage = Annotation.define<string>();

function readImage(state: EditorState, node: SyntaxNode) {
  const url = node.getChild("URL"), labelEnd = node.getChildren("LinkMark")[1];
  if (!url || !labelEnd || state.doc.lineAt(node.from).to < node.to) return;
  const titleNode = node.getChild("LinkTitle");
  const title = titleNode ? state.sliceDoc(titleNode.from + 1, titleNode.to - 1) : "";
  const reference = state.sliceDoc(url.from, url.to).replace(/^<(.*)>$/, "$1").replace(/\\([()])/g, "$1");
  const alt = state.sliceDoc(node.from + 2, labelEnd.from).replace(/\\([\[\]\\])/g, "$1");
  return { node, url, titleNode, title, reference, alt, width: imageWidth(title) };
}

export function editorImage(state: EditorState, node: SyntaxNode) {
  return node.name === "Image" ? readImage(state, node) : undefined;
}

function imageAtEdge(state: EditorState, position: number, side: -1 | 1) {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, side); node; node = node.parent) {
    if (node.name === "Image" && position === (side === 1 ? node.from : node.to)) return readImage(state, node);
  }
}

function remove(view: EditorView, image: NonNullable<ReturnType<typeof readImage>>) {
  if (view.state.readOnly || view.composing) return false;
  const { from, to } = image.node;
  view.dispatch({ changes: { from, to }, selection: { anchor: from }, userEvent: "delete.image",
    annotations: [removedImage.of(image.reference), isolateHistory.of("full")] });
  return true;
}

export function removeImageAtSelection(view: EditorView, forward: boolean): boolean {
  if (view.state.readOnly || view.composing || view.state.selection.ranges.length !== 1) return false;
  const { empty, head, from, to } = view.state.selection.main;
  const image = imageAtEdge(view.state, empty ? head : from, empty && !forward ? -1 : 1);
  return !!image && (empty || image.node.to === to) && remove(view, image);
}

const corners = [
  { name: "alto a sinistra", corner: "nw", x: -1, y: -1 },
  { name: "alto a destra", corner: "ne", x: 1, y: -1 },
  { name: "basso a sinistra", corner: "sw", x: -1, y: 1 },
  { name: "basso a destra", corner: "se", x: 1, y: 1 },
] as const;

export function bindImageEditing(view: EditorView, wrapper: HTMLElement, image: HTMLImageElement) {
  const target = () => wrapper.isConnected ? imageAtEdge(view.state, view.posAtDOM(wrapper), 1) : undefined;
  const maxWidth = () => Math.min(9999, Math.max(48, view.contentDOM.clientWidth || 9999));
  const limit = (width: number) => Math.round(Math.max(48, Math.min(maxWidth(), width)));
  const resize = (width: number) => {
    const active = target();
    if (!active || view.state.readOnly || active.width === width) return;
    const { titleNode, title, url } = active;
    const sized = titleWithImageWidth(title, width);
    if (titleNode) {
      view.dispatch({ changes: { from: titleNode.from + 1, to: titleNode.to - 1, insert: sized },
        annotations: isolateHistory.of("full"), userEvent: "input.image.resize" });
    } else {
      view.dispatch({ changes: { from: url.to, insert: ` "${sized}"` },
        annotations: isolateHistory.of("full"), userEvent: "input.image.resize" });
    }
  };
  wrapper.classList.add("is-editable");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", image.alt || "Immagine");
  image.draggable = false;
  image.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    wrapper.focus({ preventScroll: true });
  });
  image.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    wrapper.focus({ preventScroll: true });
  });
  wrapper.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); view.focus(); return; }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const active = target();
    if (!active || !remove(view, active)) return;
    event.preventDefault();
    event.stopPropagation();
    view.focus();
  });
  for (const corner of corners) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `live-image-handle is-${corner.corner}`;
    handle.setAttribute("aria-label", `Ridimensiona dall’angolo in ${corner.name}`);
    handle.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      resize(limit(image.getBoundingClientRect().width + (event.key === "ArrowRight" ? 16 : -16)));
    });
    handle.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0 || !image.naturalWidth || view.state.readOnly) return;
      event.preventDefault();
      event.stopPropagation();
      wrapper.focus({ preventScroll: true });
      const start = image.getBoundingClientRect().width, initial = image.getAttribute("width");
      const ratio = image.naturalHeight / image.naturalWidth, max = maxWidth();
      const origin = { x: event.clientX, y: event.clientY };
      const pointer = event.pointerId;
      let next = Math.round(start);
      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointer) return;
        const dx = corner.x * (event.clientX - origin.x), dy = corner.y * (event.clientY - origin.y);
        const width = Math.round(Math.max(48, Math.min(max, start + (dx + ratio * dy) / (1 + ratio ** 2))));
        if (width === next) return;
        next = width;
        applyImageWidth(image, next);
        view.requestMeasure();
      };
      const end = (finish: PointerEvent) => {
        if (finish.pointerId !== pointer) return;
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("lostpointercapture", end);
        if (initial === null) image.removeAttribute("width"); else image.setAttribute("width", initial);
        if (finish.type === "pointerup" && next !== Math.round(start)) resize(next);
        view.requestMeasure();
      };
      handle.setPointerCapture(pointer);
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("lostpointercapture", end);
    });
    wrapper.append(handle);
  }
}

import { EditorView, WidgetType } from "@codemirror/view";
import type { TextButtonBlock, TextButtonConfig } from "../../domain/textButtons";
import { textButtonIconMask } from "./textButtonIconMask";
import { analyzeMarkdown } from "./markdownAnalysis";
import { runTextButton, type TextButtonMenu } from "./textButtonEditing";

export class TextButtonWidget extends WidgetType {
  constructor(readonly raw: string, readonly config: TextButtonConfig, readonly readOnly: boolean, readonly openMenu: (target: TextButtonMenu) => void) { super(); }

  eq(other: TextButtonWidget) { return this.raw === other.raw && this.readOnly === other.readOnly; }

  toDOM(view: EditorView) {
    const document = view.dom.ownerDocument;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-text-button";
    button.title = "Inserisci testo · Tasto destro per configurare";
    button.setAttribute("aria-description", "Tasto destro o Maiusc+F10 per configurare");
    button.disabled = this.readOnly;
    const icon = document.createElement("span");
    icon.className = "text-button-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.style.maskImage = textButtonIconMask(this.config.icon) ?? "";
    button.append(icon, document.createTextNode(this.config.label));

    const locate = (): TextButtonBlock | undefined => {
      if (!button.isConnected || view.state.readOnly) return;
      const pos = view.posAtDOM(button);
      return analyzeMarkdown(view.state.doc).textButtons.find(block => block.from <= pos && block.to >= pos && block.raw === this.raw);
    };
    const configure = () => {
      const block = locate();
      if (block) this.openMenu({
        block,
        anchor: button.getBoundingClientRect(),
        previewIcon: selected => { if (button.isConnected) icon.style.maskImage = textButtonIconMask(selected) ?? ""; },
      });
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; y: number } | undefined;
    let openedByHold = false;
    const clearHold = () => { clearTimeout(timer); start = undefined; };
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      clearHold();
      if (!openedByHold) configure();
    });
    button.addEventListener("keydown", event => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      configure();
    });
    button.addEventListener("pointerdown", event => {
      clearHold();
      openedByHold = false;
      if (event.pointerType !== "touch" || !event.isPrimary) return;
      start = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => { openedByHold = true; configure(); }, 500);
    });
    button.addEventListener("pointermove", event => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) clearHold();
    });
    button.addEventListener("pointerup", clearHold);
    button.addEventListener("pointercancel", clearHold);
    button.addEventListener("click", event => {
      if (openedByHold && event.detail) return;
      const block = locate();
      if (block) runTextButton(view, block);
    });
    return button;
  }
}

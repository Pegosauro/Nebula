import { isolateHistory } from "@codemirror/commands";
import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, showTooltip, WidgetType, type Tooltip } from "@codemirror/view";
import { highlightColors, type HighlightColor } from "../../domain/markdownHighlight";
import highlightIcon from "./highlightIcon.svg?raw";

export type HighlightMarker = { from: number; to: number; color: HighlightColor };
const setPalette = StateEffect.define<HighlightMarker | null>();

export const highlightPalette = StateField.define<HighlightMarker | null>({
  create: () => null,
  update(marker, transaction) {
    for (const effect of transaction.effects) if (effect.is(setPalette)) return effect.value;
    return transaction.docChanged || transaction.selection || transaction.state.readOnly ? null : marker;
  },
  provide: field => showTooltip.from(field, marker => marker ? colorTooltip(marker) : null),
});

export function openHighlightPalette(view: EditorView, marker: HighlightMarker) {
  const open = view.state.field(highlightPalette);
  view.dispatch({ effects: setPalette.of(open?.from === marker.from ? null : marker) });
  if (open?.from === marker.from) view.focus();
}

export class HighlightIcon extends WidgetType {
  constructor(readonly marker: HighlightMarker, readonly open: boolean) { super(); }
  eq(other: HighlightIcon) {
    return this.marker.from === other.marker.from && this.marker.to === other.marker.to &&
      this.marker.color === other.marker.color && this.open === other.open;
  }
  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "live-highlight-icon";
    button.dataset.highlightColor = this.marker.color.name;
    button.setAttribute("aria-label", `Colore evidenziatore: ${this.marker.color.label}`);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", String(this.open));
    button.title = "Cambia colore dell’evidenziatore";
    button.innerHTML = highlightIcon;
    button.firstElementChild?.setAttribute("aria-hidden", "true");
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => openHighlightPalette(view, this.marker));
    return button;
  }
}

function colorTooltip(marker: HighlightMarker): Tooltip {
  return {
    pos: marker.from,
    create(view) {
      const dom = document.createElement("div");
      dom.className = "highlight-color-menu";
      dom.setAttribute("role", "menu");
      dom.setAttribute("aria-label", "Colore evidenziatore");

      const close = (focus: boolean) => {
        if (view.state.field(highlightPalette, false) !== marker) return;
        view.dispatch({ effects: setPalette.of(null) });
        if (focus) view.focus();
      };
      const buttons = highlightColors.map(color => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "menuitemradio");
        button.setAttribute("aria-checked", String(color === marker.color));
        button.tabIndex = -1;
        const swatch = document.createElement("span");
        swatch.className = "highlight-color-swatch";
        swatch.dataset.highlightColor = color.name;
        swatch.setAttribute("aria-hidden", "true");
        button.append(swatch, color.label);
        button.addEventListener("click", () => {
          if (view.state.readOnly || view.state.field(highlightPalette, false) !== marker) return;
          if (view.state.sliceDoc(marker.from, marker.to) === color.emoji) { close(true); return; }
          const changes = view.state.changes({ from: marker.from, to: marker.to, insert: color.emoji });
          view.dispatch({ changes, selection: view.state.selection.map(changes, 1), effects: setPalette.of(null), annotations: isolateHistory.of("full"), userEvent: "input.format" });
          view.focus();
        });
        dom.append(button);
        return button;
      });
      const dismiss = (event: PointerEvent) => {
        const target = event.target;
        if (target instanceof Element && (dom.contains(target) || target.closest(".live-highlight-icon"))) return;
        close(false);
      };
      dom.addEventListener("keydown", event => {
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); close(true); return; }
        const current = buttons.findIndex(button => button === document.activeElement);
        const next = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: buttons.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        buttons[(next + buttons.length) % buttons.length]?.focus();
      });
      return {
        dom,
        mount() {
          document.addEventListener("pointerdown", dismiss, true);
          buttons[highlightColors.indexOf(marker.color)]?.focus({ preventScroll: true });
        },
        destroy() { document.removeEventListener("pointerdown", dismiss, true); },
      };
    },
  };
}

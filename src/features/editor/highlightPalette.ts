import { isolateHistory } from "@codemirror/commands";
import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, showTooltip, WidgetType, type Tooltip } from "@codemirror/view";
import { highlightColors, type HighlightColor } from "../../domain/markdownHighlight";
import { paletteRows } from "../../domain/colorPalette";
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
    button.style.setProperty("--highlight-color", this.marker.color.color);
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
      dom.className = "highlight-color-menu color-palette";
      dom.setAttribute("role", "menu");
      dom.setAttribute("aria-label", "Colore evidenziatore");

      const close = (focus: boolean) => {
        if (view.state.field(highlightPalette, false) !== marker) return;
        view.dispatch({ effects: setPalette.of(null) });
        if (focus) view.focus();
      };
      const buttons: HTMLButtonElement[] = [];
      let index = 0;
      for (const row of paletteRows) {
        const line = document.createElement("div");
        line.className = "color-palette-row";
        const label = document.createElement("span");
        label.className = "color-palette-label";
        label.setAttribute("aria-hidden", "true");
        label.textContent = row.name;
        line.append(label);
        for (const _swatch of row.colors) {
          const color = highlightColors[index++]!;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "color-palette-swatch";
          button.title = color.label;
          button.style.backgroundColor = color.color;
          button.setAttribute("role", "menuitemradio");
          button.setAttribute("aria-label", color.label);
          button.setAttribute("aria-checked", String(color === marker.color));
          button.tabIndex = -1;
          button.addEventListener("click", () => {
            if (view.state.readOnly || view.state.field(highlightPalette, false) !== marker) return;
            if (view.state.sliceDoc(marker.from, marker.to) === color.prefix) { close(true); return; }
            const changes = view.state.changes({ from: marker.from, to: marker.to, insert: color.prefix });
            view.dispatch({ changes, selection: view.state.selection.map(changes, 1), effects: setPalette.of(null), annotations: isolateHistory.of("full"), userEvent: "input.format" });
            view.focus();
          });
          line.append(button);
          buttons.push(button);
        }
        dom.append(line);
      }
      const dismiss = (event: PointerEvent) => {
        const target = event.target;
        if (target instanceof Element && (dom.contains(target) || target.closest(".live-highlight-icon"))) return;
        close(false);
      };
      dom.addEventListener("keydown", event => {
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); close(true); return; }
        const current = buttons.findIndex(button => button === document.activeElement);
        const columns = paletteRows[0].colors.length;
        const next = {
          ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: current - columns, ArrowDown: current + columns,
          Home: 0, End: buttons.length - 1,
        }[event.key];
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

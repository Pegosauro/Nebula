import { isolateHistory } from "@codemirror/commands";
import { StateEffect, StateField } from "@codemirror/state";
import { showTooltip, WidgetType, type EditorView, type Tooltip } from "@codemirror/view";
import { useSettingsStore } from "../settings/settingsStore";
import { headingBars, headingDigits } from "./headingIcon";
import { inlineMenuNavigation } from "./inlineMenuNavigation";

const levels = [1, 2, 3, 4] as const;
type Level = (typeof levels)[number];
export type HeadingMarker = {
  from: number;
  to: number;
  prefixTo: number;
  level: Level;
  closing?: { from: number; to: number };
};
const setMenu = StateEffect.define<HeadingMarker | null>();

export const headingLevelMenu = StateField.define<HeadingMarker | null>({
  create: () => null,
  update(marker, transaction) {
    for (const effect of transaction.effects) if (effect.is(setMenu)) return effect.value;
    return transaction.docChanged || transaction.selection || transaction.state.readOnly ? null : marker;
  },
  provide: field => showTooltip.from(field, marker => marker ? levelTooltip(marker) : null),
});

function headingGlyph(owner: Document, level: Level): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = owner.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const bars = owner.createElementNS(namespace, "path");
  bars.setAttribute("d", headingBars);
  bars.setAttribute("fill", "none");
  bars.setAttribute("stroke", "currentColor");
  bars.setAttribute("stroke-width", "2.65");
  bars.setAttribute("stroke-linecap", "round");
  const digit = owner.createElementNS(namespace, "path");
  digit.setAttribute("d", headingDigits[level - 1]!);
  digit.setAttribute("fill", "currentColor");
  svg.append(bars, digit);
  return svg;
}

export class HeadingWidget extends WidgetType {
  constructor(readonly marker: HeadingMarker, readonly open: boolean) { super(); }

  eq(other: HeadingWidget) {
    const a = this.marker, b = other.marker;
    return a.from === b.from && a.to === b.to && a.prefixTo === b.prefixTo && a.level === b.level &&
      a.closing?.from === b.closing?.from && a.closing?.to === b.closing?.to && this.open === other.open;
  }

  toDOM(view: EditorView) {
    const owner = view.dom.ownerDocument;
    const button = owner.createElement("button");
    button.type = "button";
    button.className = "live-heading-icon";
    button.dataset.headingMarker = String(this.marker.from);
    button.setAttribute("aria-label", `Titolo H${this.marker.level}`);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", String(this.open));
    button.title = "Cambia livello del titolo";
    button.append(headingGlyph(owner, this.marker.level));
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      if (view.state.readOnly) return;
      const opened = view.state.field(headingLevelMenu)?.from === this.marker.from;
      view.dispatch({ effects: setMenu.of(opened ? null : this.marker) });
      if (opened) view.focus();
    });
    return button;
  }
}

function levelTooltip(marker: HeadingMarker): Tooltip {
  return {
    pos: marker.from,
    create(view) {
      const owner = view.dom.ownerDocument;
      const dom = owner.createElement("div");
      dom.className = "heading-level-menu";
      dom.setAttribute("role", "menu");
      dom.setAttribute("aria-label", "Livello del titolo");

      const close = (focus: boolean) => {
        if (view.state.field(headingLevelMenu, false) !== marker) return;
        view.dispatch({ effects: setMenu.of(null) });
        if (focus) view.focus();
      };
      const choose = (level: Level | "plain") => {
        if (view.state.readOnly || view.state.field(headingLevelMenu, false) !== marker) return;
        if (level !== "plain") useSettingsStore.getState().setEditorHeadingLevel(level);
        if (level === marker.level) { close(true); return; }

        const edits = level === "plain"
          ? [{ from: marker.from, to: marker.prefixTo }, ...(marker.closing ? [marker.closing] : [])]
          : [{ from: marker.from, to: marker.to, insert: "#".repeat(level) }];
        const changes = view.state.changes(edits);
        view.dispatch({
          changes, selection: view.state.selection.map(changes, 1), scrollIntoView: true,
          annotations: isolateHistory.of("full"), userEvent: "input.format",
        });
        view.focus();
      };
      const buttons = levels.map(level => {
        const item = owner.createElement("button");
        item.type = "button";
        item.tabIndex = -1;
        item.setAttribute("role", "menuitemradio");
        item.setAttribute("aria-checked", String(level === marker.level));
        item.append(headingGlyph(owner, level), `Titolo H${level}`);
        item.addEventListener("click", () => choose(level));
        dom.append(item);
        return item;
      });
      const separator = owner.createElement("hr");
      separator.setAttribute("role", "separator");
      const plain = owner.createElement("button");
      plain.type = "button";
      plain.tabIndex = -1;
      plain.setAttribute("role", "menuitem");
      plain.textContent = "Converti in testo normale";
      plain.addEventListener("click", () => choose("plain"));
      dom.append(separator, plain);
      buttons.push(plain);

      return {
        ...inlineMenuNavigation(dom, buttons, levels.indexOf(marker.level), ".live-heading-icon", close),
        getCoords(pos) {
          const anchor = view.dom.querySelector(`[data-heading-marker="${marker.from}"]`);
          return anchor?.getBoundingClientRect() ?? view.coordsAtPos(pos)!;
        },
      };
    },
  };
}

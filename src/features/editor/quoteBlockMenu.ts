import { StateEffect, StateField } from "@codemirror/state";
import { showTooltip, WidgetType, type EditorView, type Tooltip } from "@codemirror/view";
import { quoteBlockGlyph, quoteKinds, type QuoteBlockKind } from "../../infrastructure/markdown/quoteBlocks";
import { applyTextEdit } from "./editorCommands";
import { inlineMenuNavigation } from "./inlineMenuNavigation";
import { convertQuotedBlock, type QuotedBlock } from "./quoteBlockEditing";

type BlockMenu = QuotedBlock & { anchor: number };
const setMenu = StateEffect.define<BlockMenu | null>();

export const quoteBlockMenu = StateField.define<BlockMenu | null>({
  create: () => null,
  update(menu, transaction) {
    for (const effect of transaction.effects) if (effect.is(setMenu)) return effect.value;
    return transaction.docChanged || transaction.selection || transaction.state.readOnly ? null : menu;
  },
  provide: field => showTooltip.from(field, menu => menu ? blockTooltip(menu) : null),
});

export class QuoteBlockIcon extends WidgetType {
  constructor(readonly block: BlockMenu, readonly open: boolean, readonly readOnly: boolean) { super(); }

  eq(other: QuoteBlockIcon) {
    return this.block.from === other.block.from && this.block.to === other.block.to &&
      this.block.kind === other.block.kind && this.block.anchor === other.block.anchor &&
      this.open === other.open && this.readOnly === other.readOnly;
  }

  toDOM(view: EditorView) {
    const owner = view.dom.ownerDocument;
    const glyph = quoteBlockGlyph(this.block.kind, owner);
    if (this.readOnly) {
      const icon = owner.createElement("span");
      icon.className = "quote-block-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.append(glyph);
      return icon;
    }
    const button = owner.createElement("button");
    button.type = "button";
    button.className = "quote-block-icon live-quote-control";
    button.dataset.quoteBlockFrom = String(this.block.from);
    const label = quoteKinds.find(form => form.kind === this.block.kind)!.label;
    button.setAttribute("aria-label", `Cambia tipo di blocco: ${label}`);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", String(this.open));
    button.title = "Cambia tipo di blocco";
    button.append(glyph);
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      const isOpen = view.state.field(quoteBlockMenu)?.from === this.block.from;
      view.dispatch({ effects: setMenu.of(isOpen ? null : this.block) });
      if (isOpen) view.focus();
    });
    return button;
  }
}

function blockTooltip(menu: BlockMenu): Tooltip {
  return {
    pos: menu.anchor,
    create(view) {
      const owner = view.dom.ownerDocument;
      const dom = owner.createElement("div");
      dom.className = "quote-block-menu";
      dom.dataset.quoteKind = menu.kind;
      dom.setAttribute("role", "menu");
      dom.setAttribute("aria-label", "Tipo di blocco");

      const close = (focus: boolean) => {
        if (view.state.field(quoteBlockMenu, false) !== menu) return;
        view.dispatch({ effects: setMenu.of(null) });
        if (focus) view.focus();
      };
      const choose = (kind: QuoteBlockKind | "plain") => {
        if (view.state.readOnly || view.state.field(quoteBlockMenu, false) !== menu) return;
        const edit = convertQuotedBlock(view.state, menu, kind);
        if (edit) applyTextEdit(view, edit);
        else close(true);
      };
      const buttons = quoteKinds.map(({ kind, label }) => {
        const button = owner.createElement("button");
        button.type = "button";
        button.tabIndex = -1;
        button.setAttribute("role", "menuitemradio");
        button.setAttribute("aria-checked", String(kind === menu.kind));
        button.append(quoteBlockGlyph(kind, owner), label);
        button.addEventListener("click", () => choose(kind));
        dom.append(button);
        return button;
      });
      const separator = owner.createElement("hr");
      separator.setAttribute("role", "separator");
      const plain = owner.createElement("button");
      plain.type = "button";
      plain.tabIndex = -1;
      plain.setAttribute("role", "menuitem");
      plain.append(quoteBlockGlyph("plain", owner), "Converti in testo normale");
      plain.addEventListener("click", () => choose("plain"));
      dom.append(separator, plain);
      buttons.push(plain);

      return {
        ...inlineMenuNavigation(dom, buttons, quoteKinds.findIndex(form => form.kind === menu.kind), ".live-quote-control", close),
        getCoords(pos) {
          const anchor = view.dom.querySelector(`[data-quote-block-from="${menu.from}"]`);
          return anchor?.getBoundingClientRect() ?? view.coordsAtPos(pos)!;
        },
      };
    },
  };
}

import { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ColorPalette } from "../../components/ui/ColorPalette";
import type { PaletteColor } from "../../domain/colorPalette";

export function showTableColorMenu(
  host: HTMLElement, button: HTMLButtonElement, value: PaletteColor | undefined,
  apply: (color?: PaletteColor) => void, onClose: () => void,
) {
  const owner = host.ownerDocument;
  const win = owner.defaultView!;
  const popup = owner.createElement("div");
  const label = button.getAttribute("aria-label")!;
  popup.className = "inline-table-color-menu";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", label);
  // The top layer keeps the palette clear of the table and editor scrollbars.
  popup.setAttribute("popover", "manual");
  host.append(popup);
  const root = createRoot(popup);
  const events = new AbortController();
  const close = (focus = false) => {
    if (events.signal.aborted) return;
    events.abort();
    button.setAttribute("aria-expanded", "false");
    popup.remove();
    queueMicrotask(() => root.unmount());
    if (focus) button.focus({ preventScroll: true });
    onClose();
  };
  const position = () => {
    const anchor = button.getBoundingClientRect();
    const width = popup.offsetWidth, height = popup.offsetHeight, gap = 8;
    popup.style.left = `${Math.max(gap, Math.min(anchor.left, win.innerWidth - width - gap))}px`;
    const below = anchor.bottom + gap;
    const above = anchor.top - height - gap;
    const top = below + height + gap <= win.innerHeight || above < gap ? below : above;
    popup.style.top = `${Math.max(gap, Math.min(top, win.innerHeight - height - gap))}px`;
  };
  const choose = (color?: PaletteColor) => { close(); apply(color); };
  function PaletteContent() {
    const content = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      position();
      content.current?.querySelector<HTMLButtonElement>('.color-palette-swatch[tabindex="0"]')?.focus({ preventScroll: true });
    }, []);
    return <div ref={content}>
      <ColorPalette label="Tavolozza" value={value} onChange={choose} />
      <button className="inline-table-color-reset" type="button" onClick={() => choose()}>Ripristina colore</button>
    </div>;
  }
  button.setAttribute("aria-expanded", "true");
  popup.showPopover?.();
  owner.addEventListener("pointerdown", event => {
    if (!popup.contains(event.target as Node) && !button.contains(event.target as Node)) close();
  }, { capture: true, signal: events.signal });
  popup.addEventListener("pointerdown", event => {
    // Keep the grid selection until the button's click applies the color.
    if (event.button === 0 && (event.target as Element).closest("button")) event.preventDefault();
  }, { signal: events.signal });
  popup.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }, { signal: events.signal });
  win.addEventListener("resize", position, { signal: events.signal });
  owner.addEventListener("scroll", position, { capture: true, passive: true, signal: events.signal });
  root.render(<PaletteContent />);
  return close;
}

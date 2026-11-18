import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export type ToolbarMenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
};

export function ToolbarMenu({ label, icon, items, selected, primary }: {
  label: string;
  icon: ReactNode;
  items: readonly ToolbarMenuItem[] | (() => readonly ToolbarMenuItem[]);
  selected?: string;
  primary?: { label: string; run: () => void };
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !menu.current || !group.current) return;
    const panel = menu.current;
    const anchor = group.current;
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const edge = 8;
      const below = bounds.bottom + 6;
      const above = bounds.top - height - 6;
      const top = below + height <= window.innerHeight - edge ? below : Math.max(edge, above);
      const left = Math.max(edge, Math.min(bounds.left, window.innerWidth - width - edge));
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
    };
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.contains(target) && !panel.contains(target)) setOpen(false);
    };
    place();
    (panel.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? panel.querySelector("button"))?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return <div className="editor-toolbar-menu-group" ref={group}>
    {primary && <button type="button" className="editor-toolbar-menu-primary" aria-label={primary.label} title={primary.label}
      onClick={() => { setOpen(false); primary.run(); }}>{icon}</button>}
    <button ref={trigger} type="button" className="editor-toolbar-menu-trigger" aria-label={label} title={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault(); setOpen(true);
      }}>
      {!primary && <span className="editor-toolbar-menu-symbol">{icon}</span>}
      <span className="editor-toolbar-menu-arrow"><ChevronDown size={13} aria-hidden="true" /></span>
    </button>
    {open && createPortal(<div id={menuId} ref={menu} className="editor-toolbar-menu" role="menu" aria-label={label}
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault(); event.stopPropagation();
          setOpen(false); trigger.current?.focus(); return;
        }
        const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
        const active = buttons.indexOf(event.target as HTMLButtonElement);
        const index = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: buttons.length - 1 }[event.key];
        if (index === undefined) return;
        event.preventDefault();
        buttons[(index + buttons.length) % buttons.length]?.focus();
      }}>
      {(typeof items === "function" ? items() : items).map(item => <button key={item.id} type="button" role={selected === undefined ? "menuitem" : "menuitemradio"}
        aria-checked={selected === undefined ? undefined : selected === item.id} tabIndex={-1}
        onClick={() => { setOpen(false); item.run(); }}>
        {item.icon}<span>{item.label}</span>
        {selected === item.id && <Check className="editor-toolbar-menu-check" size={15} aria-hidden="true" />}
      </button>)}
    </div>, document.body)}
  </div>;
}

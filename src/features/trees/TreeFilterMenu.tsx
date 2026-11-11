import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { readableOn, type TreeCategory } from "./model";

export function TreeFilterMenu({ categories, selected, showUnmatched, onChange, onShowUnmatched, onManage }: { categories: TreeCategory[]; selected: readonly string[]; showUnmatched: boolean; onChange: (ids: string[]) => void; onShowUnmatched: (show: boolean) => void; onManage: () => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = popup.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const top = Math.max(12, Math.min(anchor.bottom + 6, window.innerHeight - panel.height - 12));
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - panel.width - 12));
      setPosition(previous => previous.top === top && previous.left === left ? previous : { top, left });
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    if (trigger.current) observer?.observe(trigger.current);
    const area = container.current?.closest(".tree-main");
    if (area) observer?.observe(area);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, categories.length]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div className="tree-filter-menu" ref={container} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className={`button ${selected.length ? "is-active" : ""}`} aria-label="Filtro categorie" aria-expanded={open} onClick={() => setOpen(value => !value)}><Filter size={15} />Filtro{selected.length > 0 && <span className="tree-filter-count">{selected.length}</span>}</button>
    {open && <div ref={popup} style={position} className="tree-filter-popover" role="group" aria-label="Filtri categorie">
      <div className="tree-filter-title"><strong>Categorie</strong><button type="button" className="tree-link" onClick={() => onChange([])}>Tutte</button></div>
      <div className="tree-filter-options">
        {[...categories].sort((a, b) => a.order - b.order).map(category => <label key={category.id}>
          <input type="checkbox" checked={selected.includes(category.id)} onChange={event => onChange(event.target.checked ? [...selected, category.id] : selected.filter(id => id !== category.id))} />
          <span className="tree-chip" style={{ background: category.color, color: readableOn(category.color) }}>{category.name}</span>
        </label>)}
        {!categories.length && <p className="tree-muted">Nessuna categoria disponibile.</p>}
      </div>
      <label className="tree-show-unmatched"><input type="checkbox" checked={showUnmatched} onChange={event => onShowUnmatched(event.target.checked)} />Mostra anche gli altri nodi</label>
      <button type="button" className="tree-link" onClick={() => { setOpen(false); onManage(); }}>Gestisci categorie…</button>
    </div>}
  </div>;
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Pencil, X } from "lucide-react";

type Item = { id: string; title: string; description?: string; summary?: ReactNode; controls?: ReactNode; disabled?: boolean };
type Target = { id: string; after: boolean };
export function DefinitionList({ items, kind, onEdit, onReorder, compact=false, showReorderHint=true }: { compact?: boolean; showReorderHint?: boolean; items: Item[]; kind: string; onEdit: (id: string) => void; onReorder?: (ids: string[]) => void }) {
  const [dragged, setDragged] = useState<string>();
  const [target, setTarget] = useState<Target>();
  const [announcement, setAnnouncement] = useState("");
  const touch = useRef<{ id: string; target?: Target } | undefined>(undefined);
  const instructions = useId();
  const move = (id: string, to: Target) => {
    if (id === to.id) return;
    const ids = items.map(item => item.id).filter(x => x !== id);
    const index = ids.indexOf(to.id);
    if (index < 0) return;
    ids.splice(index + (to.after ? 1 : 0), 0, id);
    onReorder?.(ids);
    setAnnouncement(`${items.find(item => item.id === id)?.title}: posizione ${ids.indexOf(id) + 1} di ${ids.length}.`);
  };
  const finish = () => { setDragged(undefined); setTarget(undefined); touch.current = undefined; };
  return <>
    {onReorder && <p className={showReorderHint ? "config-hint" : "config-sr-only"} id={instructions}>Trascina la maniglia per riordinare, oppure usa le frecce.</p>}
    <div className={`config-definition-list ${compact ? "is-compact" : ""}`} aria-label={kind}>
      {items.map((item, index) => <div key={item.id} data-definition-id={item.id} className={`config-definition-row ${item.disabled ? "is-disabled" : ""} ${dragged === item.id ? "is-dragging" : ""} ${target?.id === item.id ? target.after ? "drop-after" : "drop-before" : ""}`}
        onDragOver={event => { if (!dragged || !onReorder) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; const bounds = event.currentTarget.getBoundingClientRect(); setTarget({ id: item.id, after: event.clientY > bounds.top + bounds.height / 2 }); }}
        onDrop={event => { if (!dragged || !onReorder) return; event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); move(dragged, { id: item.id, after: event.clientY > bounds.top + bounds.height / 2 }); finish(); }}>
        {onReorder && <button type="button" className="config-drag-handle" draggable aria-label={`Trascina ${[item.title,item.description].filter(Boolean).join(" · ")}`} aria-describedby={instructions}
          onDragStart={event => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; setDragged(item.id); }} onDragEnd={finish}
          onKeyDown={event => { if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const next = items[index + (event.key === "ArrowUp" ? -1 : 1)]; if (next) move(item.id, { id: next.id, after: event.key === "ArrowDown" }); }}
          onPointerDown={event => { if (event.pointerType === "mouse") return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touch.current = { id: item.id }; setDragged(item.id); }}
          onPointerMove={event => { if (!touch.current) return; const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-definition-id]"); if (!row || !event.currentTarget.closest(".config-definition-list")?.contains(row)) return; const bounds = row.getBoundingClientRect(); const to = { id: row.dataset.definitionId!, after: event.clientY > bounds.top + bounds.height / 2 }; touch.current.target = to; setTarget(to); }}
          onPointerUp={() => { if (!touch.current) return; if (touch.current.target) move(touch.current.id, touch.current.target); finish(); }} onPointerCancel={() => { if (touch.current) finish(); }}><GripVertical size={18}/></button>}
        <button type="button" className="config-definition-summary" aria-label={`Modifica ${[item.title,item.description].filter(Boolean).join(" · ")}`} title={[item.title,item.description].filter(Boolean).join(" · ")} onClick={() => onEdit(item.id)}><strong>{item.title}{item.description && <span className="config-component-description"> · {item.description}</span>}</strong>{item.summary && <span>{item.summary}</span>}</button>
        <div className="config-row-controls">
          {compact ? <details className="config-row-menu" onKeyDown={event => { if(event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.currentTarget.open=false; } }} onClick={event => { if((event.target as HTMLElement).closest("button")) event.currentTarget.open=false; }}><summary aria-label={`Azioni ${item.title}`} title={`Azioni ${item.title}`}><MoreHorizontal size={18}/></summary><div>
            {item.controls}
            {onReorder && <><button type="button" className="config-icon" aria-label={`Sposta su ${[item.title,item.description].filter(Boolean).join(" · ")}`} disabled={index === 0} onClick={() => move(item.id, {id: items[index - 1]!.id, after: false})}><ArrowUp size={15}/></button><button type="button" className="config-icon" aria-label={`Sposta giù ${[item.title,item.description].filter(Boolean).join(" · ")}`} disabled={index === items.length - 1} onClick={() => move(item.id, {id: items[index + 1]!.id, after: true})}><ArrowDown size={15}/></button></>}
            <button type="button" className="config-icon" aria-label={`Apri dettagli ${[item.title,item.description].filter(Boolean).join(" · ")}`} onClick={() => onEdit(item.id)}><Pencil size={16}/></button>
          </div></details> : <>{item.controls}
          {onReorder && <div className="config-reorder-buttons"><button type="button" className="config-icon" aria-label={`Sposta su ${[item.title,item.description].filter(Boolean).join(" · ")}`} disabled={index === 0} onClick={() => move(item.id, { id: items[index - 1]!.id, after: false })}><ArrowUp size={14}/></button><button type="button" className="config-icon" aria-label={`Sposta giù ${[item.title,item.description].filter(Boolean).join(" · ")}`} disabled={index === items.length - 1} onClick={() => move(item.id, { id: items[index + 1]!.id, after: true })}><ArrowDown size={14}/></button></div>}
          <button type="button" className="config-icon" aria-label={`Apri dettagli ${[item.title,item.description].filter(Boolean).join(" · ")}`} title="Modifica" onClick={() => onEdit(item.id)}><Pencil size={16}/></button></>}
        </div>
      </div>)}
    </div>
    <span className="config-sr-only" role="status">{announcement}</span>
  </>;
}

export function DefinitionDialog({ title, description, children, onClose, onApply, wide=false, applyDisabled=false, draft }: { draft?: unknown; applyDisabled?: boolean; wide?: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; onApply: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const initialDraft = useRef(JSON.stringify(draft));
  const requestClose = () => { if (initialDraft.current === JSON.stringify(draft) || confirm("Scartare le modifiche non applicate?")) onClose(); };
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); dialog.querySelector<HTMLInputElement>("input:not([type=checkbox])")?.focus(); return () => { if (dialog.open) dialog.close(); if (previous?.isConnected) previous.focus(); }; }, []);
  return <dialog ref={ref} className={`config-definition-dialog ${wide ? "config-rule-dialog" : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); requestClose(); }}>
    <form onSubmit={event => { event.preventDefault(); onApply(); }}>
      <header><div><h2 id={titleId}>{title}</h2><p>{description ?? "Applica le modifiche per salvarle nel configuratore."}</p></div><button type="button" className="config-icon" aria-label="Chiudi dettagli" onClick={requestClose}><X size={18}/></button></header>
      <div className="config-dialog-body">{children}</div>
      <footer><button type="button" className="button button-secondary" onClick={onClose}>Annulla</button><button type="submit" disabled={applyDisabled} className="button button-primary">Applica</button></footer>
    </form>
  </dialog>;
}

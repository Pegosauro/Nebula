import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { readableOn, type TreeCategory } from "./model";

export function NodeCategoryPicker({ categories, value, onChange }: { categories: TreeCategory[]; value: string | null; onChange: (id: string | null) => void }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = [{ id: null, name: "Nessuna", color: undefined }, ...[...categories].sort((a, b) => a.order - b.order)];
  const selected = categories.find(category => category.id === value);
  const selectedIndex = Math.max(0, options.findIndex(option => option.id === value));
  const choose = (index: number) => {
    onChange(options[index]!.id);
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);
  return (
    <div ref={container} className="tree-category-picker">
      <button ref={trigger} type="button" role="combobox" aria-label="Categoria del nodo" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        className="tree-category-trigger" onClick={() => { setActive(selectedIndex); setOpen(!open); }}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === "Escape" || event.key === "Tab") { setOpen(false); if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); } return; }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const start = open ? active : selectedIndex;
            setActive(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, start + (event.key === "ArrowDown" ? 1 : -1))));
            setOpen(true);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault(); event.stopPropagation(); choose(active);
          }
        }}>
        <span className="tree-category-choice" style={selected ? { background: selected.color, color: readableOn(selected.color) } : undefined}>{selected?.name ?? "Nessuna"}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && <div id={`${id}-list`} role="listbox" aria-label="Categorie del nodo" className="tree-category-options">
        {options.map((option, index) => <button type="button" role="option" tabIndex={-1} id={`${id}-option-${index}`} key={option.id ?? "none"} aria-selected={option.id === value} className={`tree-category-option ${active === index ? "is-active" : ""}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span className="tree-category-choice" style={option.color ? { background: option.color, color: readableOn(option.color) } : undefined}>{option.name}</span>
          {option.id === value && <Check size={15} aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}

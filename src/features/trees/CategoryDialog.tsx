import { useEffect, useId, useRef, useState } from "react";
import { Bold, ChevronDown, ChevronUp, Italic, Plus, Strikethrough, Trash2, Underline, X } from "lucide-react";
import { CATEGORY_PALETTE, categoryUsage, isPaletteColor, readableOn, type CategoryTextStyle, type Tree, type TreeCategory } from "./model";

interface CategoryDialogProps {
  tree: Tree;
  onClose: () => void;
  rename: (id: string, name: string) => void;
  recolor: (id: string, color: string) => void;
  format?: (id: string, style: CategoryTextStyle) => void;
  move: (id: string, delta: number) => void;
  remove: (id: string, replacementId: string | null) => string | undefined;
  add: (name: string, color: string) => string | undefined;
}

export function CategoryDialog({ tree, onClose, rename, recolor, format, move, remove, add }: CategoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CATEGORY_PALETTE[0].color);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState<string>();
  const ordered = [...tree.categories].sort((a, b) => a.order - b.order);
  const deleting = ordered.find(category => category.id === pendingDelete);
  const used = deleting ? categoryUsage(tree, deleting.id) : [];
  useEffect(() => {
    const dialog = dialogRef.current;
    if (typeof dialog?.showModal === "function") dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const create = () => {
    const failure = add(name, color);
    if (failure) { setError(failure); return; }
    setName("");
    setError(undefined);
    const usedColors = new Set(tree.categories.map(category => category.color));
    setColor(CATEGORY_PALETTE.find(entry => !usedColors.has(entry.color) && entry.color !== color)?.color ?? CATEGORY_PALETTE[0].color);
  };
  return (
    <dialog ref={dialogRef} className="editor-dialog tree-dialog is-wide" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <div className="editor-dialog-inner">
        <header>
          <div><h2 id={titleId}>Categorie di questo albero</h2><p>Colori e formattazione valgono per questa struttura. La formattazione si applica solo ai nomi dei nodi.</p></div>
          <button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="tree-dialog-body tree-categories">
          <ol aria-label="Categorie">
            {ordered.map((category, index) => <CategoryRow key={category.id} category={category} first={index === 0} last={index === ordered.length - 1} onRename={value => rename(category.id, value)} onColor={value => recolor(category.id, value)} onFormat={value => format?.(category.id, value)} onMove={delta => move(category.id, delta)} onDelete={() => { setPendingDelete(category.id); setReplacement(""); setError(undefined); }} />)}
            {!ordered.length && <li className="tree-muted">Nessuna categoria. I nodi restano neutri.</li>}
          </ol>
          {deleting && (
            <div className="tree-delete-box" role="group" aria-label={`Elimina ${deleting.name}`}>
              <strong>{used.length ? `«${deleting.name}» è usata da ${used.length} ${used.length === 1 ? "nodo" : "nodi"} con categorie proprie.` : `Eliminare «${deleting.name}»?`}</strong>
              {used.length > 0 && <p>Scegli la categoria di sostituzione per questi nodi: {used.map(node => node.code).join(", ")}.</p>}
              {used.length > 0 && (
                <label>Sostituzione
                  <select value={replacement} onChange={event => setReplacement(event.target.value)}>
                    <option value="">Togli dai nodi</option>
                    {ordered.filter(category => category.id !== deleting.id).map(category => <option key={category.id} value={category.id}>Sostituisci con {category.name}</option>)}
                  </select>
                </label>
              )}
              <div className="tree-row-actions">
                <button type="button" className="button" onClick={() => setPendingDelete(undefined)}>Annulla</button>
                <button type="button" className="button tree-danger" onClick={() => { const failure = remove(deleting.id, used.length ? replacement || null : null); if (failure) setError(failure); else setPendingDelete(undefined); }}>Elimina categoria</button>
              </div>
            </div>
          )}
          <form className="tree-new-category" onSubmit={event => { event.preventDefault(); create(); }}>
            <label>Nuova categoria<input value={name} onChange={event => setName(event.target.value)} placeholder="Nome" maxLength={80} /></label>
            <div className="tree-palette" role="listbox" aria-label="Tavolozza">
              {CATEGORY_PALETTE.map(entry => {
                const taken = tree.categories.some(category => category.color === entry.color);
                return <button type="button" key={entry.color} role="option" aria-selected={color === entry.color} title={taken ? `${entry.name}, in uso` : entry.name} style={{ background: entry.color }} onClick={() => setColor(entry.color)}><span className="tree-sr-only">{entry.name}{taken ? ", in uso" : ""}</span></button>;
              })}
            </div>
            <span className="tree-chip" style={{ background: color, color: readableOn(color) }}>{name.trim() || "Nuova categoria"}</span>
            <button type="submit" className="button button-primary"><Plus size={15} />Aggiungi</button>
          </form>
          {error && <p role="alert" className="config-error">{error}</p>}
          {!isPaletteColor(color) && <p role="alert" className="config-error">Colore fuori tavolozza</p>}
        </div>
        <footer><button type="button" className="button button-primary" onClick={onClose}>Chiudi</button></footer>
      </div>
    </dialog>
  );
}

function CategoryRow({ category, first, last, onRename, onColor, onFormat, onMove, onDelete }: { category: TreeCategory; first: boolean; last: boolean; onRename: (name: string) => void; onColor: (color: string) => void; onFormat: (style: CategoryTextStyle) => void; onMove: (delta: number) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="tree-category-row">
      <button type="button" aria-label={`Sposta su ${category.name}`} disabled={first} onClick={() => onMove(-1)}><ChevronUp size={16} /></button>
      <button type="button" aria-label={`Sposta giù ${category.name}`} disabled={last} onClick={() => onMove(1)}><ChevronDown size={16} /></button>
      <button type="button" className="tree-color-button" style={{ background: category.color }} aria-label={`Colore di ${category.name}`} aria-expanded={open} onClick={() => setOpen(value => !value)} />
      <input aria-label={`Nome categoria ${category.name}`} defaultValue={category.name} key={category.name} onBlur={event => { if (event.target.value !== category.name) onRename(event.target.value); }} />
      <div className="tree-category-format" role="group" aria-label={`Formato per ${category.name}`}>
        {([{ key: "bold", label: "Grassetto", Icon: Bold }, { key: "italic", label: "Corsivo", Icon: Italic }, { key: "underline", label: "Sottolineato", Icon: Underline }, { key: "strike", label: "Barrato", Icon: Strikethrough }] as const).map(({ key, label, Icon }) => <button key={key} type="button" aria-label={`${label} per ${category.name}`} aria-pressed={category.textStyle?.[key] === true} onClick={() => onFormat({ ...category.textStyle, [key]: !category.textStyle?.[key] })}><Icon size={15} /></button>)}
      </div>
      <button type="button" className="tree-danger-text" aria-label={`Elimina categoria ${category.name}`} onClick={onDelete}><Trash2 size={15} /></button>
      {open && (
        <div className="tree-palette" role="listbox" aria-label={`Tavolozza per ${category.name}`}>
          {CATEGORY_PALETTE.map(entry => <button type="button" key={entry.color} role="option" aria-selected={category.color === entry.color} title={entry.name} style={{ background: entry.color }} onClick={() => { onColor(entry.color); setOpen(false); }} />)}
        </div>
      )}
    </li>
  );
}

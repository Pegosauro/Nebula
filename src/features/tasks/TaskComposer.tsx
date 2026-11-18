import { useEffect, useRef, useState } from "react";
import { Link2, Pin, Plus, X } from "lucide-react";
import { withoutMarkdownExtension } from "../../domain/path";

export function TaskComposer({ groupName, title, path, onClose, onCreate }: {
  groupName: string; title?: string; path?: string;
  onClose: () => void; onCreate: (title: string, due: string | null, pinned: boolean) => void;
}) {
  const [name, setName] = useState(title ?? "");
  const [due, setDue] = useState("");
  const [pinned, setPinned] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return <form className="task-composer" aria-label={`Nuova task in ${groupName}`} onSubmit={event => {
    event.preventDefault();
    if (name.trim()) onCreate(name.trim(), due || null, pinned);
  }} onKeyDown={event => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }}>
    <div className="task-composer-controls">
      <input ref={input} className="task-composer-title" aria-label="Titolo della nuova task" type="text" required maxLength={180} placeholder="Cosa devi fare?" value={name} onChange={event => setName(event.target.value)} />
      <label className="task-composer-date"><span>Scadenza</span><input aria-label="Scadenza della nuova task" type="date" max="9999-12-31" value={due} onChange={event => setDue(event.target.value)} /></label>
      <button className={`task-icon${pinned ? " is-pinned" : ""}`} type="button" aria-label="Importante" aria-pressed={pinned} title="Contrassegna come importante" onClick={() => setPinned(!pinned)}><Pin size={18} /></button>
      <button type="submit" className="button button-primary" disabled={!name.trim()}><Plus size={16} />Aggiungi</button>
      <button type="button" className="task-icon" aria-label="Annulla nuova task" title="Annulla (Esc)" onClick={onClose}><X size={19} /></button>
    </div>
    {path && <div className="task-draft-note"><Link2 size={15} />{withoutMarkdownExtension(path)}</div>}
  </form>;
}

import { useRef, useState, type FormEvent } from "react";
import { Folder, Link2, Pin, Plus } from "lucide-react";
import { EditorDialog } from "../editor/EditorDialog";
import { withoutMarkdownExtension } from "../../domain/path";
import type { TaskGroup } from "./taskModel";

export function NewTaskDialog({ groups, initialGroup, title, path, onClose, onCreate }: {
  groups: TaskGroup[]; initialGroup: string; title?: string; path?: string;
  onClose: () => void; onCreate: (title: string, groupId: string | null, due: string | null, pinned: boolean) => void;
}) {
  const [name, setName] = useState(title ?? "");
  const [group, setGroup] = useState(initialGroup);
  const [due, setDue] = useState("");
  const [pinned, setPinned] = useState(false);

  return <EditorDialog title="Nuova task" onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (name.trim()) onCreate(name.trim(), group || null, due || null, pinned);
    }}>
      <div className="task-dialog-body">
        <label>Titolo<input type="text" autoFocus required maxLength={180} placeholder="Cosa devi fare?" value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="task-dialog-fields">
          <label>Gruppo<select value={group} onChange={event => setGroup(event.target.value)}><option value="">Senza gruppo</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Scadenza<input type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
        </div>
        <label className="task-done-field"><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} /><Pin size={15} /> Importante</label>
        {path && <div className="task-draft-note"><Link2 size={16} />{withoutMarkdownExtension(path)}</div>}
      </div>
      <footer><button type="button" className="button button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button button-primary" disabled={!name.trim()}><Plus size={16} />Crea task</button></footer>
    </form>
  </EditorDialog>;
}

export function TaskGroupsDialog({ groups, onCreate, onRename, onClose }: { groups: TaskGroup[]; onCreate: (name: string) => void; onRename: (id: string, name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const duplicate = groups.some(group => group.id !== editing && group.name.toLocaleLowerCase("it") === name.trim().toLocaleLowerCase("it"));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || duplicate) return;
    if (editing) onRename(editing, name.trim());
    else onCreate(name.trim());
    setName("");
    setEditing("");
    input.current?.focus();
  }
  return <EditorDialog title="Gruppi task" onClose={onClose}>
    <form onSubmit={submit}>
      <div className="task-dialog-body">
        <label>{editing ? "Rinomina gruppo" : "Nuovo gruppo"}<input ref={input} type="text" autoFocus required maxLength={80} placeholder="Nome del gruppo" value={name} onChange={event => setName(event.target.value)} /></label>
        {duplicate && <p className="task-validation">Esiste già un gruppo con questo nome.</p>}
        <div className="task-group-options">{groups.map(group => <button key={group.id} type="button" className="task-note-option" onClick={() => { setEditing(group.id); setName(group.name); input.current?.focus(); }}><Folder size={16} />{group.name}</button>)}</div>
      </div>
      <footer><button type="button" className="button button-secondary" onClick={onClose}>Chiudi</button><button type="submit" className="button button-primary" disabled={!name.trim() || duplicate}>{editing ? "Salva nome" : "Aggiungi gruppo"}</button></footer>
    </form>
  </EditorDialog>;
}

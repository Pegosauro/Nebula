import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Check, Folder } from "lucide-react";
import { EditorDialog } from "../editor/EditorDialog";
import { groupColors, taskGroupColor, type GroupColor, type TaskGroup } from "./taskModel";

const swatches = Object.entries(groupColors) as [GroupColor, (typeof groupColors)[GroupColor]][];

export function TaskGroupsDialog({ groups, onCreate, onRename, onClose }: {
  groups: TaskGroup[]; onCreate: (name: string, color: GroupColor) => void;
  onRename: (id: string, name: string, color: GroupColor) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<GroupColor>("slate");
  const [editing, setEditing] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const duplicate = groups.some(group => group.id !== editing && group.name.toLocaleLowerCase("it") === name.trim().toLocaleLowerCase("it"));

  function clear() {
    setName("");
    setEditing("");
    setColor("slate");
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || duplicate) return;
    if (editing) onRename(editing, name.trim(), color);
    else onCreate(name.trim(), color);
    clear();
  }

  return <EditorDialog title="Gruppi task" onClose={onClose}>
    <form onSubmit={submit}>
      <div className="task-dialog-body">
        {groups.length > 0 && <div className="task-group-options" aria-label="Gruppi esistenti">{groups.map(group => <button key={group.id} type="button" className="task-note-option" aria-pressed={editing === group.id} onClick={() => {
          setEditing(group.id);
          setName(group.name);
          setColor(group.color && Object.hasOwn(groupColors, group.color) ? group.color : "slate");
          input.current?.focus();
        }}><Folder size={16} style={{ color: taskGroupColor(group.color) }} />{group.name}</button>)}</div>}
        <label>{editing ? "Modifica gruppo" : "Nuovo gruppo"}<input ref={input} type="text" autoFocus required maxLength={80} placeholder="Nome del gruppo" value={name} onChange={event => setName(event.target.value)} /></label>
        {duplicate && <p className="task-validation">Esiste già un gruppo con questo nome.</p>}
        <fieldset className="task-palette">
          <legend>Colore del gruppo</legend>
          {swatches.map(([id, swatch]) => <label key={id} className="task-swatch" style={{ "--swatch": swatch.hex } as CSSProperties} title={swatch.name}>
            <input type="radio" name="task-group-color" aria-label={swatch.name} checked={color === id} onChange={() => setColor(id)} />
            <span aria-hidden="true">{color === id && <Check size={16} strokeWidth={3} />}</span>
          </label>)}
        </fieldset>
      </div>
      <footer>
        {editing && <button type="button" className="button button-secondary" onClick={clear}>Nuovo gruppo</button>}
        <button type="button" className="button button-secondary" onClick={onClose}>Chiudi</button>
        <button type="submit" className="button button-primary" disabled={!name.trim() || duplicate}>{editing ? "Salva gruppo" : "Aggiungi gruppo"}</button>
      </footer>
    </form>
  </EditorDialog>;
}

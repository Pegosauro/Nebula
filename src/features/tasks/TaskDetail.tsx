import { useRef, useState, type FormEvent } from "react";
import { CalendarDays, ChevronRight, Link2, ListChecks, MessageSquare, Pin, Plus, Trash2, X } from "lucide-react";
import type { VaultEntry } from "../../domain/vault";
import { withoutMarkdownExtension } from "../../domain/path";
import { EditorDialog } from "../editor/EditorDialog";
import { quadrantLabels } from "./TaskCard";
import { taskQuadrant, type Task, type TaskGroup, type Urgency } from "./taskModel";

const commentTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

export function TaskDetail({ task, groups, notes, tomorrow, onClose, onChange, onOpenNote, onDelete }: {
  task: Task; groups: TaskGroup[]; notes: Map<string, VaultEntry>; tomorrow: string; onClose: () => void;
  onChange: (update: (current: Task) => Task) => void; onOpenNote: (entry: VaultEntry) => void; onDelete: () => void;
}) {
  const savedTitle = useRef(task.title);
  const [title, setTitle] = useState(task.title);
  const [subtask, setSubtask] = useState("");
  const [comment, setComment] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [pickingNote, setPickingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const completed = task.subtasks.filter(item => item.done).length;
  savedTitle.current = task.title;

  function commitTitle() {
    const cleaned = title.trim() || savedTitle.current;
    setTitle(cleaned);
    if (cleaned !== savedTitle.current) onChange(current => ({ ...current, title: cleaned }));
  }

  function addSubtask(event: FormEvent) {
    event.preventDefault();
    if (!subtask.trim()) return;
    const item = { id: crypto.randomUUID(), title: subtask.trim(), done: false };
    onChange(current => ({ ...current, subtasks: [...current.subtasks, item] }));
    setSubtask("");
  }

  function addComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    const item = { id: crypto.randomUUID(), text: comment.trim(), createdAt: new Date().toISOString() };
    onChange(current => ({ ...current, comments: [...current.comments, item] }));
    setComment("");
  }

  const available = pickingNote
    ? Array.from(notes.values()).filter(entry => !task.notes.includes(entry.path) && entry.path.toLocaleLowerCase("it").includes(noteQuery.trim().toLocaleLowerCase("it"))).slice(0, 12)
    : [];

  return <aside className="task-detail" aria-label="Dettagli task">
    <header className="task-detail-header">
      <span>Dettagli task</span>
      <button className={`task-icon${task.pinned ? " is-pinned" : ""}`} aria-label="Importante" aria-pressed={task.pinned} title={task.pinned ? "Togli pin" : "Contrassegna come importante"} type="button" onClick={() => onChange(current => ({ ...current, pinned: !current.pinned }))}><Pin size={18} /></button>
      <button className="task-icon" type="button" aria-label="Chiudi dettagli" onClick={onClose}><X size={19} /></button>
    </header>
    <div className="task-detail-body">
      <input className="task-detail-title" aria-label="Titolo task" value={title} maxLength={180} onChange={event => setTitle(event.target.value)} onBlur={commitTitle} onKeyDown={event => {
        if (event.key === "Enter") event.currentTarget.blur();
      }} />
      <label className="task-done-field"><input type="checkbox" checked={task.done} onChange={event => onChange(current => ({ ...current, done: event.target.checked }))} /> Completata</label>
      <div className="task-fields">
        <label><span><CalendarDays size={15} />Scadenza</span><input aria-label="Scadenza" type="date" value={task.due ?? ""} onChange={event => onChange(current => ({ ...current, due: event.target.value || null }))} /></label>
        <label><span>Gruppo</span><select aria-label="Gruppo task" value={task.groupId ?? ""} onChange={event => onChange(current => ({ ...current, groupId: event.target.value || null }))}>
          <option value="">Senza gruppo</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>
        <label><span>Urgenza</span><select aria-label="Urgenza" value={task.urgency} onChange={event => onChange(current => ({ ...current, urgency: event.target.value as Urgency }))}>
          <option value="auto">Automatica</option><option value="urgent">Urgente</option><option value="not-urgent">Non urgente</option>
        </select></label>
      </div>
      {!task.done && <p className="task-current-quadrant">{quadrantLabels[taskQuadrant(task, tomorrow)]}</p>}
      <section className="task-detail-section">
        <h3><ListChecks size={17} />Sotto-task {task.subtasks.length > 0 && <span>{completed}/{task.subtasks.length}</span>}</h3>
        {task.subtasks.length > 0 && <progress aria-label="Avanzamento sotto-task" value={completed} max={task.subtasks.length} />}
        {task.subtasks.map(item => <div className="task-detail-row" key={item.id}>
          <label className={item.done ? "is-done" : ""}><input type="checkbox" checked={item.done} onChange={event => onChange(current => ({ ...current, subtasks: current.subtasks.map(entry => entry.id === item.id ? { ...entry, done: event.target.checked } : entry) }))} />{item.title}</label>
          <button type="button" className="task-icon" aria-label={`Rimuovi sotto-task ${item.title}`} onClick={() => onChange(current => ({ ...current, subtasks: current.subtasks.filter(entry => entry.id !== item.id) }))}><X size={15} /></button>
        </div>)}
        <form className="task-inline-form" onSubmit={addSubtask}>
          <input aria-label="Nuova sotto-task" placeholder="Aggiungi sotto-task…" maxLength={180} value={subtask} onChange={event => setSubtask(event.target.value)} />
          <button type="submit" className="task-icon" aria-label="Aggiungi sotto-task" disabled={!subtask.trim()}><Plus size={17} /></button>
        </form>
      </section>
      <section className="task-detail-section">
        <h3><Link2 size={17} />Note collegate</h3>
        {task.notes.map(path => {
          const note = notes.get(path);
          return <div className="task-detail-row" key={path}>
            {note ? <button className="task-note-link" type="button" onClick={() => onOpenNote(note)} title={path}>{withoutMarkdownExtension(note.name)}<ChevronRight size={14} /></button> : <span className="task-missing-note" title={path}>{withoutMarkdownExtension(path)} · Nota non disponibile</span>}
            <button className="task-icon" type="button" aria-label={`Scollega ${note?.name ?? path}`} onClick={() => onChange(current => ({ ...current, notes: current.notes.filter(link => link !== path) }))}><X size={15} /></button>
          </div>;
        })}
        <button type="button" className="task-text-button" aria-expanded={pickingNote} onClick={() => setPickingNote(!pickingNote)}><Plus size={15} />Collega nota</button>
        {pickingNote && <div className="task-note-picker">
          <input type="search" aria-label="Cerca una nota da collegare" placeholder="Cerca per nome o cartella" value={noteQuery} onChange={event => setNoteQuery(event.target.value)} autoFocus />
          {available.map(note => <button key={note.path} className="task-note-option" type="button" onClick={() => {
            onChange(current => ({ ...current, notes: current.notes.includes(note.path) ? current.notes : [...current.notes, note.path] }));
            setPickingNote(false);
            setNoteQuery("");
          }}><strong>{withoutMarkdownExtension(note.name)}</strong><span>{note.path}</span></button>)}
          {available.length === 0 && <p>Nessuna nota da collegare.</p>}
        </div>}
      </section>
      <section className="task-detail-section">
        <h3><MessageSquare size={17} />Commenti</h3>
        {task.comments.map(item => <article className="task-comment" key={item.id}><time dateTime={item.createdAt}>{commentTime.format(new Date(item.createdAt))}</time><p>{item.text}</p></article>)}
        <form className="task-comment-form" onSubmit={addComment}>
          <textarea aria-label="Commento veloce" placeholder="Scrivi un commento…" rows={2} maxLength={4000} value={comment} onChange={event => setComment(event.target.value)} />
          <button type="submit" className="button button-secondary" disabled={!comment.trim()}>Invia</button>
        </form>
      </section>
      <button type="button" className="task-text-button task-delete" onClick={() => setDeleting(true)}><Trash2 size={15} />Elimina task</button>
    </div>
    {deleting && <EditorDialog title="Elimina task" onClose={() => setDeleting(false)}>
      <p className="task-confirm-copy">Vuoi eliminare «{task.title}» con le sue sotto-task e i commenti?</p>
      <footer><button type="button" className="button button-secondary" onClick={() => setDeleting(false)}>Annulla</button><button type="button" className="button button-primary" onClick={onDelete}>Elimina</button></footer>
    </EditorDialog>}
  </aside>;
}

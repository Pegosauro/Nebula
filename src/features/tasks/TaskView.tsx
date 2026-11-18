import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDays, Clock3, Folder, Grid2X2, Inbox, List, Plus, Zap } from "lucide-react";
import type { VaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { TaskCard, quadrantLabels } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { NewTaskDialog, TaskGroupsDialog } from "./TaskDialogs";
import { localDay, matchesFilter, moveTask, newTask, orderTasks, taskQuadrant, type Quadrant, type Task, type TaskFilter } from "./taskModel";
import { useTaskNavigation } from "./taskNavigation";
import { taskSession } from "./taskSession";
import "./tasks.css";

const filters: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "Tutte" }, { id: "today", label: "Oggi" }, { id: "overdue", label: "Scadute" }, { id: "important", label: "Importanti" },
];
const quadrants = [
  { id: "do", icon: Zap }, { id: "plan", icon: CalendarDays }, { id: "quick", icon: Clock3 }, { id: "later", icon: Inbox },
] as const;

function collectNotes(entries: VaultEntry[], notes = new Map<string, VaultEntry>()) {
  for (const entry of entries) {
    if (entry.extension === ".md") notes.set(entry.path, entry);
    if (entry.children) collectNotes(entry.children, notes);
  }
  return notes;
}

export default function TaskView({ vaultId }: { vaultId: string }) {
  const session = useMemo(() => taskSession(vaultId), [vaultId]);
  const { board, status, error } = useSyncExternalStore(session.store.subscribe, session.store.getState);
  const root = useVaultStore(state => state.snapshot?.root);
  const notes = useMemo(() => collectNotes(root ?? []), [root]);
  const draft = useTaskNavigation(state => state.draft?.vaultId === vaultId ? state.draft : null);
  const { view, group, filter, selectedId } = useSyncExternalStore(session.layout.subscribe, session.layout.getState);
  const [adding, setAdding] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [dragged, setDragged] = useState<string>();
  const [dropTarget, setDropTarget] = useState<Quadrant>();
  const [announcement, setAnnouncement] = useState("");
  const [today, setToday] = useState(() => localDay());
  const [tomorrow, setTomorrow] = useState(() => localDay(new Date(), 1));

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setToday(localDay(now));
      setTomorrow(localDay(now, 1));
    };
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  const groups = board?.groups ?? [];
  const tasks = board?.tasks ?? [];
  const selected = tasks.find(task => task.id === selectedId);
  const groupName = new Map(groups.map(item => [item.id, item.name]));
  const scoped = tasks.filter(task => !group || (group === "none" ? !task.groupId : task.groupId === group));
  const scopedActive = scoped.filter(task => !task.done);
  const listTasks = scoped.filter(task => matchesFilter(task, filter, today)).sort(orderTasks);
  const pinned = listTasks.filter(task => task.pinned && !task.done);
  const regular = listTasks.filter(task => !task.pinned || task.done);
  const columns = [...groups, { id: null, name: "Senza gruppo" }].map(item => ({ ...item, tasks: regular.filter(task => task.groupId === item.id) })).filter(item => item.tasks.length);
  const activeCount = tasks.filter(task => !task.done).length;
  const differ = status === "error" || status === "conflict";

  function changeTask(id: string, update: (current: Task) => Task) {
    session.change(current => {
      const task = current.tasks.find(item => item.id === id);
      if (!task) return current;
      const next = update(task);
      return next === task ? current : { ...current, tasks: current.tasks.map(item => item.id === id ? next : item) };
    });
  }

  function shift(id: string, target: Quadrant) {
    changeTask(id, task => moveTask(task, target, tomorrow));
    setAnnouncement(`Task spostata in ${quadrantLabels[target]}.`);
    stopDrag();
  }

  function stopDrag() {
    setDragged(undefined);
    setDropTarget(undefined);
  }

  function closeCreate() {
    setAdding(false);
    if (draft) useTaskNavigation.getState().setDraft(null);
  }

  function renderCard(task: Task) {
    return <TaskCard key={task.id} task={task} group={groupName.get(task.groupId ?? "")} today={today} tomorrow={tomorrow}
      selected={task.id === selectedId} matrix={view === "matrix"} onOpen={() => session.layout.setState({ selectedId: task.id === selectedId ? undefined : task.id })}
      onToggle={() => changeTask(task.id, current => ({ ...current, done: !current.done }))}
      onMove={target => {
        shift(task.id, target);
        requestAnimationFrame(() => document.getElementById(`task-title-${task.id}`)?.focus());
      }} onDrag={() => setDragged(task.id)} onEndDrag={stopDrag} />;
  }

  return <section className="tasks-workspace" aria-label="Task">
    <header className="tasks-header">
      <div className="tasks-heading"><h1>Task</h1><p>{activeCount} {activeCount === 1 ? "task aperta" : "task aperte"}</p></div>
      <div className="tasks-header-controls">
        <div className="tasks-view-switch" role="group" aria-label="Vista task">
          <button type="button" aria-pressed={view === "list"} onClick={() => { session.layout.setState({ view: "list" }); stopDrag(); }}><List size={17} />Lista</button>
          <button type="button" aria-pressed={view === "matrix"} onClick={() => session.layout.setState({ view: "matrix" })}><Grid2X2 size={16} />Matrice</button>
        </div>
        <div className="tasks-group-control">
          <Folder size={16} />
          <select aria-label="Filtra per gruppo" value={group} onChange={event => session.layout.setState({ group: event.target.value })}>
            <option value="">Tutti i gruppi</option><option value="none">Senza gruppo</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <button type="button" className="button button-secondary tasks-manage-groups" disabled={!board} onClick={() => setGroupsOpen(true)}>Gruppi</button>
        <button type="button" className="button button-primary tasks-create" disabled={!board || status === "loading"} onClick={() => setAdding(true)}><Plus size={18} />Nuova task</button>
      </div>
    </header>
    {differ && <div className="task-error" role="alert">
      <span>{error}</span>
      {status === "conflict" && board ? <>
        <a className="button button-secondary" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(board, null, 2))}`} download="nebula-task-bozza.json">Scarica bozza</a>
        <button className="button button-secondary" type="button" onClick={() => {
          if (window.confirm("Ricaricare le task dal Vault e scartare le modifiche locali non salvate?")) void session.load();
        }}>Ricarica dal Vault</button>
      </> : <button className="button button-secondary" type="button" onClick={() => void (board ? session.save() : session.load())}>Riprova</button>}
    </div>}
    <div className="task-visually-hidden" role="status">{announcement}</div>
    {board && <div className={`tasks-body${selected ? " has-detail" : ""}`}>
      <div className="tasks-main">
        {view === "list" ? <div className="tasks-list">
          <div className="tasks-filters" role="group" aria-label="Filtri task">
            {filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => session.layout.setState({ filter: item.id })}>{item.label}<span>{scoped.filter(task => matchesFilter(task, item.id, today)).length}</span></button>)}
          </div>
          {listTasks.length ? <>
            {pinned.length > 0 && <section className="task-list-group" aria-label="Task importanti"><h2>Importanti<span>{pinned.length}</span></h2>{pinned.map(task => renderCard(task))}</section>}
            {columns.map(item => <section className="task-list-group" key={item.id ?? "none"} aria-label={item.name}><h2>{item.name}<span>{item.tasks.length}</span></h2>{item.tasks.map(task => renderCard(task))}</section>)}
          </> : <div className="tasks-empty"><Inbox size={27} /><h2>{tasks.length ? "Nessuna task in questa vista" : "Ancora nessuna task"}</h2><button type="button" className="button button-secondary" onClick={() => setAdding(true)}><Plus size={16} />Nuova task</button></div>}
        </div> : <div className="tasks-matrix">
          <header className="tasks-matrix-heading"><div><h2>Matrice delle priorità</h2><p>Trascina una task per cambiare importanza o urgenza.</p></div><span>{scopedActive.length} {scopedActive.length === 1 ? "task aperta" : "task aperte"}</span></header>
          <div className="tasks-matrix-layout">
            <div className="task-axis task-axis-urgent">Urgente</div><div className="task-axis task-axis-not-urgent">Non urgente</div>
            <div className="task-axis task-axis-important">Importante</div><div className="task-axis task-axis-other">Poco importante</div>
            {quadrants.map(({ id, icon: Icon }) => {
              const cards = scopedActive.filter(task => taskQuadrant(task, tomorrow) === id).sort(orderTasks);
              return <section key={id} aria-label={quadrantLabels[id]} className={`task-quadrant task-quadrant-${id}${dragged ? " accepts-task" : ""}${dropTarget === id ? " is-drop-target" : ""}`} onDragOver={event => {
                if (dragged && event.dataTransfer.types.includes("application/x-nebula-task")) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dropTarget !== id) setDropTarget(id);
                }
              }} onDragLeave={event => {
                if (dropTarget === id && !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDropTarget(undefined);
              }} onDrop={event => {
                if (!dragged || event.dataTransfer.getData("application/x-nebula-task") !== dragged) return;
                event.preventDefault();
                shift(dragged, id);
              }}>
                <header><span className="task-quadrant-icon"><Icon size={18} /></span><h3>{quadrantLabels[id]}</h3><span className="task-quadrant-count">{cards.length}</span></header>
                <div className="task-quadrant-cards">{cards.length ? cards.map(task => renderCard(task)) : <p className="task-quadrant-empty">{dragged ? "Rilascia qui" : "Nessuna task"}</p>}</div>
              </section>;
            })}
          </div>
        </div>}
      </div>
      {selected && <TaskDetail key={selected.id} task={selected} groups={groups} notes={notes} tomorrow={tomorrow}
        onClose={() => session.layout.setState({ selectedId: undefined })} onChange={update => changeTask(selected.id, update)}
        onOpenNote={entry => useWorkspaceStore.getState().openEntry(entry)}
        onDelete={() => {
          session.change(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== selected.id) }));
          session.layout.setState({ selectedId: undefined });
        }} />}
    </div>}
    {status === "loading" && <div className="editor-loading">Caricamento task…</div>}
    {board && (adding || draft) && <NewTaskDialog groups={groups} initialGroup={group === "none" ? "" : group} title={draft?.title} path={draft?.path} onClose={closeCreate} onCreate={(title, groupId, due, pinned) => {
      const task = newTask(title, groupId, due, pinned, draft?.path);
      session.change(current => ({ ...current, tasks: [task, ...current.tasks] }));
      session.layout.setState({ group: groupId ?? "", filter: "all", selectedId: task.id });
      closeCreate();
    }} />}
    {board && groupsOpen && <TaskGroupsDialog groups={groups} onClose={() => setGroupsOpen(false)} onCreate={name => {
      const id = crypto.randomUUID();
      session.change(current => ({ ...current, groups: [...current.groups, { id, name }] }));
    }} onRename={(id, name) => session.change(current => ({ ...current, groups: current.groups.map(item => item.id === id ? { ...item, name } : item) }))} />}
  </section>;
}

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CalendarDays, ChevronDown, Clock3, Folder, Grid2X2, GripVertical, Inbox, List, Plus, Zap } from "lucide-react";
import type { VaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { TaskCard, quadrantLabels } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { createPortal } from "react-dom";
import { TaskComposer } from "./TaskComposer";
import { useMatrixDrag } from "./useMatrixDrag";
import { TaskGroupsDialog } from "./TaskDialogs";
import { localDay, matchesFilter, moveTask, newTask, orderTasks, taskGroupColor, taskQuadrant, type Quadrant, type Task, type TaskFilter, type TaskGroup } from "./taskModel";
import { useTaskNavigation } from "./taskNavigation";
import { taskSession } from "./taskSession";
import "./tasks.css";

const filters: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "Tutte" }, { id: "today", label: "Oggi" }, { id: "overdue", label: "Scadute" }, { id: "important", label: "Importanti" },
];
const quadrants = [
  { id: "do", icon: Zap }, { id: "plan", icon: CalendarDays }, { id: "quick", icon: Clock3 }, { id: "later", icon: Inbox },
] as const;

const ungrouped: TaskGroup = { id: "none", name: "Senza gruppo" };

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
  const { view, group, filter, selectedId, collapsed } = useSyncExternalStore(session.layout.subscribe, session.layout.getState);
  const [adding, setAdding] = useState<{ group: string; trigger: string }>();
  const compose = adding ?? (draft ? { group: ungrouped.id, trigger: "tasks-create" } : undefined);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const drag = useMatrixDrag();
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
  const groupById = new Map(groups.map(item => [item.id, item]));
  const scoped = tasks.filter(task => !group || (group === "none" ? !task.groupId : task.groupId === group));
  const scopedActive = scoped.filter(task => !task.done);
  const tasksByGroup = new Map<string, Task[]>();
  for (const task of tasks.filter(item => matchesFilter(item, filter, today)).sort(orderTasks)) {
    const id = task.groupId && groupById.has(task.groupId) ? task.groupId : ungrouped.id;
    const rows = tasksByGroup.get(id) ?? [];
    rows.push(task);
    tasksByGroup.set(id, rows);
  }
  const activeCount = tasks.filter(task => !task.done).length;
  const differ = status === "error" || status === "conflict";

  const changeTask = session.changeTask;

  function shift(id: string, target: Quadrant) {
    changeTask(id, task => moveTask(task, target, tomorrow));
    drag.setLanded(id);
    setAnnouncement(`Task spostata in ${quadrantLabels[target]}.`);
  }

  function setCollapsed(id: string, closed: boolean) {
    session.layout.setState(state => ({
      collapsed: closed ? [...state.collapsed, id] : state.collapsed.filter(item => item !== id),
    }));
  }

  function startCreate(id: string, trigger: string) {
    if (draft) useTaskNavigation.getState().setDraft(null);
    if (collapsed.includes(id)) setCollapsed(id, false);
    setAdding({ group: id, trigger });
  }

  function closeCreate(restoreFocus = true) {
    setAdding(undefined);
    if (draft) useTaskNavigation.getState().setDraft(null);
    if (restoreFocus && compose) document.getElementById(compose.trigger)?.focus();
  }

  function renderComposer(item: TaskGroup) {
    return <TaskComposer key={`${item.id}:${draft?.path ?? ""}`} groupName={item.name} title={draft?.title} path={draft?.path} onClose={closeCreate} onCreate={(title, due, pinned) => {
      const groupId = item.id === ungrouped.id ? null : item.id;
      const task = newTask(title, groupId, due, pinned, draft?.path);
      session.change(current => ({ ...current, tasks: [task, ...current.tasks] }));
      session.layout.setState({ filter: "all", group: group && group !== item.id ? "" : group, selectedId: undefined });
      closeCreate(false);
      requestAnimationFrame(() => document.getElementById(`task-title-${task.id}`)?.focus());
    }} />;
  }

  function renderCard(task: Task) {
    const taskGroup = task.groupId ? groupById.get(task.groupId) : undefined;
    const color = taskGroup && taskGroupColor(taskGroup.color);
    const origin = taskQuadrant(task, tomorrow);
    return <TaskCard key={task.id} task={task} group={taskGroup?.name} color={color} today={today} tomorrow={tomorrow}
      selected={task.id === selectedId} matrix={view === "matrix"} dragging={drag.feedback?.task.id === task.id} landed={drag.landed === task.id}
      onOpen={() => session.layout.setState({ selectedId: task.id === selectedId ? undefined : task.id })}
      onToggle={() => changeTask(task.id, current => ({ ...current, done: !current.done }))}
      onMove={target => {
        shift(task.id, target);
        requestAnimationFrame(() => document.getElementById(`task-title-${task.id}`)?.focus());
      }} onDrag={(start, point, card) => drag.move({ id: task.id, title: task.title, group: taskGroup?.name, color }, origin, start, point, card)}
      onDrop={point => {
        const target = drag.drop(point);
        if (target && target !== origin) shift(task.id, target);
      }} onEndDrag={drag.end} onLanded={() => drag.setLanded(undefined)} />;
  }

  return <section className="tasks-workspace" aria-label="Task">
    <header className="tasks-header">
      <div className="tasks-heading"><h1>Task</h1><p>{activeCount} {activeCount === 1 ? "task aperta" : "task aperte"}</p></div>
      <div className="tasks-header-controls">
        <div className="tasks-view-switch" role="group" aria-label="Vista task">
          <button type="button" aria-pressed={view === "list"} onClick={() => { session.layout.setState({ view: "list" }); drag.end(); }}><List size={17} />Lista</button>
          <button type="button" aria-pressed={view === "matrix"} onClick={() => session.layout.setState({ view: "matrix" })}><Grid2X2 size={16} />Matrice</button>
        </div>
        {view === "matrix" && <div className="tasks-group-control">
          <Folder size={16} />
          <select aria-label="Filtra per gruppo" value={group} onChange={event => session.layout.setState({ group: event.target.value })}>
            <option value="">Tutti i gruppi</option><option value="none">Senza gruppo</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>}
        <button type="button" className="button button-secondary tasks-manage-groups" disabled={!board} onClick={() => setGroupsOpen(true)}>Gruppi</button>
        <button type="button" id="tasks-create" className="button button-primary tasks-create" disabled={!board || status === "loading"} onClick={() => startCreate(ungrouped.id, "tasks-create")}><Plus size={18} />Nuova task</button>
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
      <div className="tasks-main" ref={drag.main}>
        {view === "list" ? <div className="tasks-list">
          <div className="tasks-filters" role="group" aria-label="Filtri task">
            {filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => session.layout.setState({ filter: item.id })}>{item.label}<span>{tasks.filter(task => matchesFilter(task, item.id, today)).length}</span></button>)}
          </div>
          {[...groups, ungrouped].map(item => {
            const rows = tasksByGroup.get(item.id) ?? [];
            const isComposing = compose?.group === item.id;
            const isCollapsed = collapsed.includes(item.id) && !(draft && isComposing);
            const contentId = `task-group-content-${item.id}`;
            const addId = `task-group-add-${item.id}`;
            return <section className="task-list-group" key={item.id} aria-label={item.name} style={{ "--task-group-color": taskGroupColor(item.color) } as CSSProperties}>
              <header className="task-group-header">
                <h2><button type="button" className="task-group-toggle" aria-label={item.name} aria-expanded={!isCollapsed} aria-controls={contentId} onClick={() => setCollapsed(item.id, !isCollapsed)}>
                  <ChevronDown className="task-group-chevron" size={16} /><Folder size={17} className="task-group-folder" /><span className="task-group-name">{item.name}</span><span className="task-group-count">{rows.length}</span>
                </button></h2>
                <button className="task-icon task-group-add" type="button" id={addId} aria-label={`Aggiungi task in ${item.name}`} title={`Aggiungi task in ${item.name}`} onClick={() => startCreate(item.id, addId)}><Plus size={19} /></button>
              </header>
              <div id={contentId} hidden={isCollapsed}>
                {isComposing && renderComposer(item)}
                {rows.length ? rows.map(renderCard) : !isComposing && <p className="task-group-empty">Nessuna task</p>}
              </div>
            </section>;
          })}
        </div> : <div className="tasks-matrix">
          <header className="tasks-matrix-heading"><div><h2>Matrice delle priorità</h2><p>Trascina una task per cambiare importanza o urgenza.</p></div><span>{scopedActive.length} {scopedActive.length === 1 ? "task aperta" : "task aperte"}</span></header>
          {compose && renderComposer(groupById.get(compose.group) ?? ungrouped)}
          <div className="tasks-matrix-layout">
            <div className="task-axis task-axis-urgent">Urgente</div><div className="task-axis task-axis-not-urgent">Non urgente</div>
            <div className="task-axis task-axis-important">Importante</div><div className="task-axis task-axis-other">Poco importante</div>
            {quadrants.map(({ id, icon: Icon }) => {
              const cards = scopedActive.filter(task => taskQuadrant(task, tomorrow) === id).sort(orderTasks);
              return <section key={id} aria-label={quadrantLabels[id]} data-task-quadrant={id} className={`task-quadrant task-quadrant-${id}${drag.feedback && drag.feedback.origin !== id ? " accepts-task" : ""}${drag.feedback?.target === id && drag.feedback.origin !== id ? " is-drop-target" : ""}`}>
                <header><span className="task-quadrant-icon"><Icon size={18} /></span><h3>{quadrantLabels[id]}</h3><span className="task-quadrant-count">{cards.length}</span></header>
                <div className="task-quadrant-cards">{cards.length ? cards.map(task => renderCard(task)) : <p className="task-quadrant-empty">{drag.feedback && drag.feedback.origin !== id ? "Rilascia qui" : "Nessuna task"}</p>}</div>
                {cards.length > 0 && drag.feedback?.target === id && drag.feedback.origin !== id && <span className="task-drop-label">Rilascia qui</span>}
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
    {drag.feedback && createPortal(<div ref={drag.preview} className="task-drag-preview" aria-hidden="true"
      style={{ width: drag.feedback.width, "--task-group-color": drag.feedback.task.color } as CSSProperties}>
      <GripVertical size={18} />
      <div><strong>{drag.feedback.task.title}</strong>{drag.feedback.task.group && <small>{drag.feedback.task.group}</small>}</div>
    </div>, document.body)}
    {board && groupsOpen && <TaskGroupsDialog groups={groups} onClose={() => setGroupsOpen(false)} onCreate={(name, color) => {
      const id = crypto.randomUUID();
      session.change(current => ({ ...current, groups: [...current.groups, { id, name, color }] }));
    }} onRename={(id, name, color) => session.change(current => ({ ...current, groups: current.groups.map(item => item.id === id ? { ...item, name, color } : item) }))} />}
  </section>;
}

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, CalendarDays, Check, Pin, Undo2 } from "lucide-react";
import { localDay, type Task } from "../tasks/taskModel";
import { taskSession } from "../tasks/taskSession";
import { useTaskNavigation } from "../tasks/taskNavigation";
import { useWorkspaceStore } from "./workspaceStore";

const visibleLimit = 4;

function priority(task: Task, today: string) {
  if (task.due && task.due < today) return 0;
  if (task.due === today) return 1;
  return task.pinned ? 2 : 3;
}

export function tasksForHome(tasks: readonly Task[], today: string) {
  return tasks.filter(task => !task.done && priority(task, today) < 3).sort((a, b) =>
    priority(a, today) - priority(b, today)
    || (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99")
    || Number(b.pinned) - Number(a.pinned),
  ).slice(0, visibleLimit);
}

const noTasks: readonly Task[] = [];

export function HomeToday({ vaultId }: { vaultId: string }) {
  const session = useMemo(() => taskSession(vaultId), [vaultId]);
  const { board, status, error } = useSyncExternalStore(session.store.subscribe, session.store.getState);
  const [today, setToday] = useState(() => localDay());
  const [exiting, setExiting] = useState<{ task: Task; index: number }>();
  const [restoring, setRestoring] = useState<string>();
  const [completed, setCompleted] = useState<Task>();
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoButton = useRef<HTMLButtonElement>(null);
  const allTasks = useRef<HTMLButtonElement>(null);
  const checks = useRef(new Map<string, HTMLButtonElement>());
  const tasks = useMemo(() => tasksForHome(board?.tasks ?? noTasks, today), [board?.tasks, today]);
  const rows = exiting ? [...tasks.slice(0, visibleLimit - 1)] : tasks;
  if (exiting) rows.splice(exiting.index, 0, exiting.task);

  useEffect(() => {
    mounted.current = true;
    const update = () => setToday(localDay());
    const running = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => {
      mounted.current = false;
      window.clearInterval(running);
      window.removeEventListener("focus", update);
      clearTimeout(exitTimer.current);
      clearTimeout(undoTimer.current);
    };
  }, []);

  function openTasks(task?: Task) {
    useTaskNavigation.getState().setDraft(null);
    session.layout.setState(state => ({
      filter: "all",
      group: "",
      selectedId: task?.id,
      ...(task ? { collapsed: state.collapsed.filter(id => id !== (task.groupId ?? "none")) } : {}),
    }));
    useWorkspaceStore.getState().setActivity("tasks");
  }

  async function markTask(task: Task, done: boolean, index = 0) {
    if (pending.current || session.store.getState().status !== "ready") return;
    const changed = session.changeTask(task.id, current => current.done === done ? current : { ...current, done });
    if (!changed) return;
    pending.current = true;
    setBusy(true);
    setUndone(false);
    clearTimeout(exitTimer.current);
    clearTimeout(undoTimer.current);
    if (done) {
      setCompleted(undefined);
      setRestoring(undefined);
      setExiting({ task, index });
      const source = checks.current.get(task.id);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      exitTimer.current = setTimeout(() => {
        const hasFocus = source && document.activeElement === source;
        setExiting(undefined);
        if (hasFocus) (undoButton.current ?? allTasks.current)?.focus({ preventScroll: true });
      }, reduced ? 0 : 220);
    } else {
      setExiting(undefined);
      setRestoring(task.id);
    }

    const saved = await session.flush();
    if (!saved) session.changeTask(task.id, current => current.done === done ? { ...current, done: !done } : current);
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!saved) {
      clearTimeout(exitTimer.current);
      setExiting(undefined);
      setRestoring(undefined);
      return;
    }
    if (done) setCompleted(task);
    else {
      const shouldFocus = document.activeElement === undoButton.current;
      setCompleted(undefined);
      setUndone(true);
      if (shouldFocus) requestAnimationFrame(() => (checks.current.get(task.id) ?? allTasks.current)?.focus({ preventScroll: true }));
      undoTimer.current = setTimeout(() => setUndone(false), 2200);
    }
  }

  const failed = status === "error" || status === "conflict";
  return <section className="home-today-panel" aria-labelledby="home-today-title">
    <div className="home-card home-today">
      <h2 id="home-today-title" className="home-card-title"><CalendarDays size={20} aria-hidden="true" />Da fare oggi</h2>
      {status === "loading" && <p className="home-empty" role="status">Caricamento task…</p>}
      {failed && <p className="home-error home-task-error" role="alert">{error || "Impossibile accedere alle task."}</p>}
      {!rows.length && status !== "loading" && !failed && <p className="home-empty">Nessuna task in scadenza o importante.</p>}
      {!!rows.length && <ul className="home-task-list" aria-label="Task in evidenza">
        {rows.map((task, index) => {
          const closing = exiting?.task.id === task.id;
          const level = priority(task, today);
          return <li className={`home-task-slot${closing ? " is-leaving" : restoring === task.id ? " is-returning" : ""}`} key={task.id}
            onAnimationEnd={event => { if (event.target === event.currentTarget && restoring === task.id) setRestoring(undefined); }}>
            <div className="home-task-fold">
              <div className="home-task-row">
                <button type="button" className="home-task-check" role="checkbox" aria-checked={closing}
                  aria-disabled={busy || status !== "ready" || closing} aria-label={`Completa ${task.title}`}
                  ref={element => { if (element) checks.current.set(task.id, element); else checks.current.delete(task.id); }}
                  onClick={() => { if (!closing) void markTask(task, true, index); }}>
                  {closing && <Check size={17} strokeWidth={2.5} aria-hidden="true" />}
                </button>
                <div className="home-task-meta">
                  <button type="button" className="home-entry-title" onClick={() => openTasks(task)} disabled={closing}>{task.title}</button>
                  <span className={`home-task-state is-${level === 0 ? "overdue" : level === 1 ? "today" : "important"}`}>
                    {level === 0 ? "Scaduta" : level === 1 ? "Oggi" : <><Pin size={13} aria-hidden="true" />Importante</>}
                  </span>
                </div>
              </div>
            </div>
          </li>;
        })}
      </ul>}
      <div className="home-tasks-footer">
        <button ref={allTasks} type="button" className="home-text-action" onClick={() => openTasks()}>Apri tutte le task <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    {(completed || undone) && <div className="home-task-feedback">
      <span role="status">{undone ? <><Undo2 size={16} aria-hidden="true" />Completamento annullato</> : <><Check size={16} aria-hidden="true" />Task completata</>}</span>
      {completed && <button ref={undoButton} className="home-text-action" type="button" disabled={busy || status !== "ready"} onClick={() => void markTask(completed, false)}>Annulla</button>}
    </div>}
  </section>;
}

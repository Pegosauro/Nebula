import { useEffect, useRef } from "react";
import { CalendarDays, Check, GripVertical, Link2, ListChecks, MessageSquare, MoreHorizontal, Pin } from "lucide-react";
import { taskQuadrant, type Quadrant, type Task } from "./taskModel";

export const quadrantLabels: Record<Quadrant, string> = {
  do: "Fai subito", plan: "Pianifica", quick: "Gestisci rapidamente", later: "Rimanda",
};

const shortDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

export function TaskCard({ task, group, today, tomorrow, matrix, selected, onOpen, onToggle, onMove, onDrag, onEndDrag }: {
  task: Task; group?: string; today: string; tomorrow: string; matrix: boolean; selected: boolean;
  onOpen: () => void; onToggle: () => void; onMove: (target: Quadrant) => void; onDrag: () => void; onEndDrag: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    if (matrix) document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [matrix]);

  const completed = task.subtasks.filter(item => item.done).length;
  const dueLabel = task.due === today ? "Oggi" : task.due === tomorrow ? "Domani" : task.due && shortDay.format(new Date(`${task.due}T12:00`));
  return <article className={`task-card${selected ? " is-selected" : ""}${task.done ? " is-done" : ""}`}>
    {matrix && <span className="task-grip" draggable onDragStart={event => {
      event.dataTransfer.setData("application/x-nebula-task", task.id);
      event.dataTransfer.effectAllowed = "move";
      onDrag();
    }} onDragEnd={onEndDrag} title="Trascina per spostare"><GripVertical size={15} /></span>}
    <button className="task-check" type="button" role="checkbox" aria-checked={task.done} aria-label={`Completata: ${task.title}`} onClick={onToggle}>
      {task.done && <Check size={12} strokeWidth={2.7} />}
    </button>
    <div className="task-card-content">
      <button id={`task-title-${task.id}`} className="task-card-title" aria-expanded={selected} type="button" onClick={onOpen}>{task.title}</button>
      <div className="task-card-meta">
        {matrix && group && <span className="task-card-group">{group}</span>}
        {task.subtasks.length > 0 && <span title="Sotto-task completate"><ListChecks size={13} />{completed}/{task.subtasks.length}</span>}
        {task.notes.length > 0 && <span title="Note collegate"><Link2 size={13} />{task.notes.length}</span>}
        {task.comments.length > 0 && <span title="Commenti"><MessageSquare size={13} />{task.comments.length}</span>}
      </div>
    </div>
    <div className="task-card-end">
      {task.pinned && <Pin className="task-pin-icon" size={15} aria-label="Importante" />}
      {dueLabel && <time className={`task-date-tag${!task.done && task.due! < today ? " is-overdue" : !task.done && task.due === today ? " is-today" : ""}`} dateTime={task.due!} title={task.due!.split("-").reverse().join("/")}><CalendarDays size={12} />{dueLabel}</time>}
      {matrix && <details ref={menu} className="task-move-menu" onKeyDown={event => {
        if (event.key === "Escape") {
          event.stopPropagation();
          event.preventDefault();
          event.currentTarget.open = false;
          summary.current?.focus();
        }
      }}>
        <summary ref={summary} className="task-icon" aria-label={`Sposta ${task.title}`} title="Sposta nel quadrante"><MoreHorizontal size={17} /></summary>
        <div className="task-move-options" role="group" aria-label="Sposta nel quadrante">
          {(Object.keys(quadrantLabels) as Quadrant[]).map(target => <button type="button" key={target} disabled={target === taskQuadrant(task, tomorrow)} onClick={() => {
            if (menu.current) menu.current.open = false;
            onMove(target);
          }}>{quadrantLabels[target]}</button>)}
        </div>
      </details>}
    </div>
  </article>;
}

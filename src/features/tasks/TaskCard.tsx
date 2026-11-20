import { useEffect, useRef, type CSSProperties } from "react";
import { CalendarDays, Check, GripVertical, Link2, ListChecks, MessageSquare, MoreHorizontal, Pin } from "lucide-react";
import { taskQuadrant, type Quadrant, type Task } from "./taskModel";
import { animateChecklistToggle } from "../../components/ui/checklistMotion";

export const quadrantLabels: Record<Quadrant, string> = {
  do: "Fai subito", plan: "Pianifica", quick: "Gestisci rapidamente", later: "Rimanda",
};

const shortDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

export function TaskCard({ task, group, color, today, tomorrow, matrix, selected, dragging, landed, onOpen, onToggle, onMove, onDrag, onDrop, onEndDrag, onLanded }: {
  task: Task; group?: string; color?: string; today: string; tomorrow: string; matrix: boolean; selected: boolean; dragging: boolean; landed: boolean;
  onOpen: () => void; onToggle: () => void; onMove: (target: Quadrant) => void; onDrag: (start: { x: number; y: number }, point: { x: number; y: number }, card: HTMLElement) => void;
  onDrop: (point: { x: number; y: number }) => void; onEndDrag: () => void; onLanded: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const dragStart = useRef<{ x: number; y: number }>(null);
  const moved = (x: number, y: number) => dragStart.current
    && Math.hypot(x - dragStart.current.x, y - dragStart.current.y) >= 6;
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    if (matrix) document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [matrix]);

  const completed = task.subtasks.filter(item => item.done).length;
  const dueLabel = task.due === today ? "Oggi" : task.due === tomorrow ? "Domani" : task.due && shortDay.format(new Date(`${task.due}T12:00`));
  return <article ref={card} className={`task-card${selected ? " is-selected" : ""}${task.done ? " is-done" : ""}${dragging ? " is-dragging" : ""}${landed ? " is-landed" : ""}`} onAnimationEnd={event => {
    if (event.target === event.currentTarget && landed) onLanded();
  }} style={color ? { "--task-group-color": color } as CSSProperties : undefined}>
    {matrix && <span className="task-grip" aria-hidden="true" title="Trascina per spostare" onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      dragStart.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (card.current && dragStart.current && moved(event.clientX, event.clientY)) onDrag(dragStart.current, { x: event.clientX, y: event.clientY }, card.current);
    }} onPointerUp={event => {
      if (moved(event.clientX, event.clientY)) onDrop({ x: event.clientX, y: event.clientY });
    }} onLostPointerCapture={() => {
      dragStart.current = null;
      onEndDrag();
    }}><GripVertical size={15} /></span>}
    <button className="task-check" type="button" role="checkbox" aria-checked={task.done} aria-label={`Completata: ${task.title}`} onClick={event => {
      onToggle();
      animateChecklistToggle(event.currentTarget, !task.done);
    }}>
      {task.done && <Check size={16} strokeWidth={2.7} />}
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
      {matrix && <details name="task-move" ref={menu} className="task-move-menu" onKeyDown={event => {
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

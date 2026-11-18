import { useCallback, useEffect, useRef, useState } from "react";
import type { Quadrant } from "./taskModel";

type Point = { x: number; y: number };
type DraggedTask = { id: string; title: string; group?: string; color?: string };
type DragPosition = { task: DraggedTask; origin: Quadrant; width: number; offset: Point; point: Point };
type DragFeedback = { task: DraggedTask; origin: Quadrant; width: number; target?: Quadrant };

function quadrantAt({ x, y }: Point): Quadrant | undefined {
  const value = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-task-quadrant]")?.dataset.taskQuadrant;
  if (value === "do" || value === "plan" || value === "quick" || value === "later") return value;
}

export function useMatrixDrag() {
  const main = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const active = useRef<DragPosition | null>(null);
  const frame = useRef(0);
  const cancelled = useRef(false);
  const [feedback, setFeedback] = useState<DragFeedback>();
  const [landed, setLanded] = useState<string>();

  const clear = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    active.current = null;
    setFeedback(undefined);
  }, []);

  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key !== "Escape" || !active.current) return;
      cancelled.current = true;
      clear();
    }
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      cancelAnimationFrame(frame.current);
    };
  }, [clear]);

  function draw() {
    frame.current = 0;
    const drag = active.current;
    if (!drag) return;
    const { point, offset } = drag;
    if (preview.current) {
      const x = Math.min(Math.max(6, point.x - offset.x), Math.max(6, window.innerWidth - drag.width - 6));
      preview.current.style.transform = `translate3d(${x}px,${Math.max(6, point.y - offset.y)}px,0)`;
    }
    const box = main.current;
    const rect = box?.getBoundingClientRect();
    if (box && rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
      const edge = 45;
      const top = point.y - rect.top;
      const bottom = rect.bottom - point.y;
      const delta = top < edge ? -(edge - top) / 4 : bottom < edge ? (edge - bottom) / 4 : 0;
      const before = box.scrollTop;
      if (delta) box.scrollTop += delta;
      if (before !== box.scrollTop || !preview.current) frame.current = requestAnimationFrame(draw);
    } else if (!preview.current) frame.current = requestAnimationFrame(draw);
    const target = quadrantAt(point);
    setFeedback(current => current?.target === target ? current : { task: drag.task, origin: drag.origin, width: drag.width, target });
  }

  function move(task: DraggedTask, origin: Quadrant, start: Point, point: Point, card: HTMLElement) {
    if (cancelled.current) return;
    if (!active.current) {
      const rect = card.getBoundingClientRect();
      active.current = { task, origin, width: Math.min(340, rect.width, window.innerWidth - 12), offset: { x: start.x - rect.left, y: start.y - rect.top }, point };
      setLanded(undefined);
      setFeedback({ task, origin, width: active.current.width, target: quadrantAt(point) });
    }
    active.current.point = point;
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }

  function drop(point: Point) {
    if (cancelled.current) return;
    const target = quadrantAt(point);
    clear();
    return target;
  }

  function end() {
    cancelled.current = false;
    if (active.current) clear();
  }

  return { main, preview, feedback, landed, setLanded, move, drop, end };
}

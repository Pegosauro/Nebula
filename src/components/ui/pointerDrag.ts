export interface DragPoint { x: number; y: number }

interface DragHandlers {
  start: (point: DragPoint) => void;
  move: (point: DragPoint) => void;
  end: (point?: DragPoint) => void;
}

export function trackPointerDrag(source: HTMLElement, event: PointerEvent | TouchEvent, handlers: DragHandlers) {
  const doc = source.ownerDocument, win = doc.defaultView!;
  const touch = "changedTouches" in event ? event.changedTouches[0] : undefined;
  const pointer = "pointerId" in event ? event : undefined;
  const contact = touch ?? pointer;
  if (!contact) return () => {};
  const start = { x: contact.clientX, y: contact.clientY };
  let active = false, ended = false;
  const listeners = new AbortController();
  const { signal } = listeners;
  let hold: number | undefined;

  const activate = () => {
    active = true;
    handlers.start(start);
  };
  const finish = (point?: DragPoint) => {
    if (ended) return;
    ended = true;
    win.clearTimeout(hold);
    listeners.abort();
    if (active) {
      // The release belongs to the drag. A new pointer press remains a normal click.
      const click = new AbortController();
      const remove = () => click.abort();
      doc.addEventListener("pointerdown", remove, { capture: true, once: true, signal: click.signal });
      doc.addEventListener("click", e => {
        if (e.detail) { e.preventDefault(); e.stopImmediatePropagation(); remove(); }
      }, { capture: true, signal: click.signal });
      win.setTimeout(remove, 400);
    }
    handlers.end(active ? point : undefined);
  };
  const move = (e: Event, point: DragPoint) => {
    if (!active) {
      if (Math.hypot(point.x - start.x, point.y - start.y) < 6) return;
      if (touch) { finish(); return; }
      activate();
    }
    if (e.cancelable) e.preventDefault();
    handlers.move(point);
  };

  if (touch) {
    const locate = (e: TouchEvent) => Array.from(e.changedTouches).find(item => item.identifier === touch.identifier);
    hold = win.setTimeout(activate, 290);
    doc.addEventListener("touchmove", e => {
      const next = locate(e);
      if (next) move(e, { x: next.clientX, y: next.clientY });
    }, { passive: false, capture: true, signal });
    doc.addEventListener("touchend", e => {
      const next = locate(e);
      if (!next) return;
      if (active && e.cancelable) e.preventDefault();
      finish({ x: next.clientX, y: next.clientY });
    }, { passive: false, capture: true, signal });
    doc.addEventListener("touchcancel", () => finish(), { signal });
    doc.addEventListener("touchstart", e => { if (e.touches.length > 1) finish(); }, { passive: true, signal });
    doc.addEventListener("contextmenu", e => { if (active) e.preventDefault(); }, { capture: true, signal });
  } else if (pointer) {
    doc.addEventListener("pointermove", e => {
      if (e.pointerId === pointer.pointerId) move(e, { x: e.clientX, y: e.clientY });
    }, { signal });
    doc.addEventListener("pointerup", e => {
      if (e.pointerId !== pointer.pointerId) return;
      if (active && e.cancelable) e.preventDefault();
      finish({ x: e.clientX, y: e.clientY });
    }, { signal });
    doc.addEventListener("pointercancel", e => { if (e.pointerId === pointer.pointerId) finish(); }, { signal });
  }
  win.addEventListener("blur", () => finish(), { signal });
  win.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (active) { e.preventDefault(); e.stopPropagation(); }
    finish();
  }, { capture: true, signal });
  return () => finish();
}

export function dragPreview(source: HTMLElement, label: string, start: DragPoint) {
  const doc = source.ownerDocument, win = doc.defaultView!;
  const preview = doc.createElement("div");
  preview.className = "nebula-drag-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.textContent = label;
  doc.body.append(preview);
  const rect = preview.getBoundingClientRect();
  const move = ({ x, y }: DragPoint) => {
    const left = x + rect.width + 22 > win.innerWidth ? x - rect.width - 14 : x + 14;
    const top = y + rect.height + 22 > win.innerHeight ? y - rect.height - 14 : y + 14;
    preview.style.transform = `translate3d(${Math.max(6, left)}px,${Math.max(6, top)}px,0)`;
  };
  move(start);
  return { move, remove: () => preview.remove() };
}

export function scrollAtDragEdge(element: HTMLElement, { x, y }: DragPoint, axis: "x" | "y") {
  const rect = element.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
  const start = axis === "x" ? x - rect.left : y - rect.top;
  const end = axis === "x" ? rect.right - x : rect.bottom - y;
  const delta = start < 36 ? -Math.ceil((36 - start) / 3) : end < 36 ? Math.ceil((36 - end) / 3) : 0;
  if (!delta) return false;
  const key = axis === "x" ? "scrollLeft" : "scrollTop", before = element[key];
  element[key] += delta;
  return before !== element[key];
}

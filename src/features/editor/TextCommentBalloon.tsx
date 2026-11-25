import { MessageSquare, Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { TextComment } from "../../domain/textComments";

const selector = "[data-text-comment]";
type Anchor = { element: HTMLElement; rect: DOMRect; id: string; pinned: boolean; touch: boolean };

export function TextCommentBalloon({ root, comments, onEdit }: {
  root: RefObject<HTMLElement | null>;
  comments: readonly TextComment[];
  onEdit?: (id: string) => void;
}) {
  const [anchor, setAnchor] = useState<Anchor>();
  const card = useRef<HTMLDivElement>(null);
  const active = useRef<Anchor>(undefined);
  const dismiss = useRef(() => {});
  const keepOpen = useRef(() => {});
  const leave = useRef(() => {});
  const id = useId();

  useEffect(() => {
    const host = root.current;
    if (!host || !comments.length) return;
    let enterTimer: ReturnType<typeof setTimeout>, exitTimer: ReturnType<typeof setTimeout>;
    let pending: HTMLElement | undefined;
    let touchStart: { x: number; y: number; element: HTMLElement } | undefined;
    function close() {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      pending = undefined;
      if (active.current?.element.getAttribute("aria-describedby") === id) active.current.element.removeAttribute("aria-describedby");
      active.current = undefined;
      setAnchor(undefined);
    }
    dismiss.current = close;
    keepOpen.current = () => clearTimeout(exitTimer);
    leave.current = () => {
      clearTimeout(enterTimer);
      pending = undefined;
      clearTimeout(exitTimer);
      if (!active.current?.pinned) exitTimer = setTimeout(close, 155);
    };
    function target(event: Event) {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
      return element && host!.contains(element) ? element : null;
    }
    function show(element: HTMLElement, pinned = false, touch = false, x?: number, y?: number) {
      close();
      if (!element.isConnected || !comments.some(comment => comment.id === element.dataset.textComment)) return;
      const rect = [...element.getClientRects()].find(box => x !== undefined && y !== undefined && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
        ?? element.getBoundingClientRect();
      const next = { element, id: element.dataset.textComment!, rect, pinned, touch };
      active.current = next;
      element.setAttribute("aria-describedby", id);
      setAnchor(next);
    }
    function over(event: PointerEvent) {
      if (event.pointerType === "touch" || event.buttons || active.current?.pinned) return;
      const element = target(event);
      if (!element) return;
      clearTimeout(exitTimer);
      if (active.current?.element === element || pending === element) return;
      clearTimeout(enterTimer);
      pending = element;
      enterTimer = setTimeout(() => show(element, false, false, event.clientX, event.clientY), 230);
    }
    function out(event: PointerEvent) {
      const element = target(event);
      const related = event.relatedTarget;
      if (!element || related instanceof Node && (element.contains(related) || card.current?.contains(related))) return;
      leave.current();
    }
    function focus(event: FocusEvent) {
      const element = target(event);
      if (element?.matches(":focus-visible") && !active.current?.touch) show(element, true);
    }
    function blur(event: FocusEvent) {
      if (target(event) && event.relatedTarget instanceof Node && !card.current?.contains(event.relatedTarget)) close();
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || !active.current) return;
      const element = active.current.element;
      if (card.current?.contains(document.activeElement)) element.focus({ preventScroll: true });
      event.stopPropagation();
      close();
    }
    function press(event: PointerEvent) {
      const element = target(event);
      touchStart = element && !element.closest("a") && event.pointerType === "touch"
        ? { element, x: event.clientX, y: event.clientY } : undefined;
      if (!card.current?.contains(event.target as Node) && active.current?.element !== element) close();
    }
    function tap(event: PointerEvent) {
      if (!touchStart || event.pointerType !== "touch") return;
      const start = touchStart;
      touchStart = undefined;
      if (target(event) !== start.element || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
      if (active.current?.element === start.element && active.current.touch) close();
      else show(start.element, true, true, event.clientX, event.clientY);
    }
    function scroll(event: Event) {
      if (!card.current?.contains(event.target as Node)) close();
    }

    host.addEventListener("pointerover", over);
    host.addEventListener("pointerout", out);
    host.addEventListener("pointerup", tap);
    host.addEventListener("focusin", focus);
    host.addEventListener("focusout", blur);
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key, true);
    return () => {
      close();
      host.removeEventListener("pointerover", over);
      host.removeEventListener("pointerout", out);
      host.removeEventListener("pointerup", tap);
      host.removeEventListener("focusin", focus);
      host.removeEventListener("focusout", blur);
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", key, true);
    };
  }, [root, comments, id]);

  const comment = anchor && comments.find(item => item.id === anchor.id);
  if (!comment || !anchor) return null;
  const { rect } = anchor;
  const width = Math.min(320, window.innerWidth - 24);
  const center = (rect.left + rect.right) / 2;
  const left = Math.max(12, Math.min(center - width / 2, window.innerWidth - width - 12));
  const above = rect.top > 160 && (rect.top > window.innerHeight / 2 || rect.top > 230);
  const room = above ? rect.top : window.innerHeight - rect.bottom;
  return createPortal(
    <div ref={card} className={`text-comment-balloon ${above ? "is-above" : "is-below"}`} style={{
      width, left, top: above ? rect.top - 8 : rect.bottom + 8, "--comment-tail-x": `${Math.max(16, Math.min(width - 16, center - left))}px`,
    } as React.CSSProperties} onPointerEnter={() => keepOpen.current()} onPointerLeave={() => leave.current()}>
      <div className="text-comment-balloon-content" style={{ maxHeight: Math.max(48, Math.min(240, room - 20)) }}>
        <header><MessageSquare size={16} aria-hidden="true" /><strong>Commento</strong>
          {onEdit && <button type="button" aria-label="Modifica commento" title="Modifica commento" onClick={() => { dismiss.current(); onEdit(comment.id); }}><Pencil size={15} /></button>}
        </header>
        <p id={id}>{comment.text}</p>
      </div>
    </div>, document.body,
  );
}

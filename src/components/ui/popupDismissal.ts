import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";

function outsideBounds(element: HTMLElement, x: number, y: number): boolean {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return x < left || x >= right || y < top || y >= bottom;
}

function isBackdrop(event: MouseEvent<HTMLDialogElement>): boolean {
  return event.target === event.currentTarget && outsideBounds(event.currentTarget, event.clientX, event.clientY);
}

/** A dialog click can target the backdrop when a selection starts inside and ends outside. */
export function useBackdropDismiss(dialog: RefObject<HTMLDialogElement | null>, onDismiss: () => void) {
  usePopupSelection(dialog, true);
  const gesture = useRef<{ pointer: number; releasedOutside: boolean } | null>(null);
  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      gesture.current = isBackdrop(event) ? { pointer: event.pointerId, releasedOutside: false } : null;
    },
    onPointerUp(event: PointerEvent<HTMLDialogElement>) {
      if (gesture.current?.pointer === event.pointerId) gesture.current.releasedOutside = isBackdrop(event);
    },
    onPointerCancel(event: PointerEvent<HTMLDialogElement>) {
      if (gesture.current?.pointer === event.pointerId) gesture.current = null;
    },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      const dismiss = gesture.current?.releasedOutside && event.detail > 0 && isBackdrop(event);
      gesture.current = null;
      if (dismiss) onDismiss();
    },
  };
}

/** Keep a hover popup available for copying until the next press or an explicit dismissal. */
export function usePopupSelection(surface: RefObject<HTMLElement | null>, open: boolean) {
  const pointer = useRef<number | null>(null);
  const releasedOutside = useRef(false);
  useEffect(() => {
    if (!open) return;
    const element = surface.current;
    const win = element?.ownerDocument.defaultView;
    if (!element || !win) return;
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    let lastRange: Range | undefined;
    let restore = 0;
    const reset = () => {
      pointer.current = null;
      releasedOutside.current = false;
      lastRange = undefined;
      win.cancelAnimationFrame(restore);
    };
    const readSelection = () => {
      const selection = element.ownerDocument.getSelection();
      if (selection?.rangeCount && !selection.isCollapsed && element.contains(selection.anchorNode)
        && element.contains(selection.focusNode)) lastRange = selection.getRangeAt(0).cloneRange();
    };
    element.ownerDocument.addEventListener("selectionchange", () => {
      if (pointer.current !== null) readSelection();
    }, { signal: listeners.signal });
    win.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      reset();
      if (element.contains(event.target as Node) && !outsideBounds(element, event.clientX, event.clientY)) pointer.current = event.pointerId;
    }, options);
    win.addEventListener("pointermove", event => {
      if (pointer.current === event.pointerId) readSelection();
    }, options);
    win.addEventListener("pointerup", event => {
      if (pointer.current !== event.pointerId) return;
      pointer.current = null;
      releasedOutside.current = outsideBounds(element, event.clientX, event.clientY);
      if (!releasedOutside.current) return;
      readSelection();
      const range = lastRange;
      if (!range) return;
      // Chromium can collapse a text range after the pointer crosses a
      // floating surface. Let the native release finish before restoring it.
      restore = win.requestAnimationFrame(() => {
        if (!element.isConnected || !element.contains(range.commonAncestorContainer)) return;
        const selection = element.ownerDocument.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    }, options);
    win.addEventListener("pointercancel", event => {
      if (pointer.current === event.pointerId) reset();
    }, options);
    win.addEventListener("blur", reset, { signal: listeners.signal });

    return () => { listeners.abort(); reset(); };
  }, [open, surface]);
  return useCallback(() => pointer.current !== null || releasedOutside.current, []);
}

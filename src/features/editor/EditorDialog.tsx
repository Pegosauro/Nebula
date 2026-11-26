import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useBackdropDismiss } from "../../components/ui/popupDismissal";
import { X } from "lucide-react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  anchor?: DOMRect;
  preferSide?: boolean;
  className?: string;
};

export function EditorDialog({ title, onClose, children, wide = false, anchor, preferSide = false, className = "" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropDismiss(ref, onClose);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const place = () => {
      if (!anchor) return;
      const { width, height } = dialog.getBoundingClientRect();
      const gap = 8;
      const fitsRight = anchor.right + gap + width <= window.innerWidth - gap;
      const fitsLeft = preferSide && anchor.left - gap - width >= gap;
      const preferredX = fitsRight ? anchor.right + gap : fitsLeft ? anchor.left - width - gap : anchor.left;
      const preferredY = fitsRight || fitsLeft ? anchor.top : anchor.bottom + gap;
      dialog.style.left = `${Math.max(gap, Math.min(preferredX, window.innerWidth - width - gap))}px`;
      dialog.style.top = `${Math.max(gap, Math.min(preferredY, window.innerHeight - height - gap))}px`;
    };
    place();
    const sizeObserver = anchor && typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : undefined;
    sizeObserver?.observe(dialog);
    if (anchor) window.addEventListener("resize", place);
    return () => { sizeObserver?.disconnect(); window.removeEventListener("resize", place); dialog.close(); };
  }, [anchor, preferSide]);
  return <dialog ref={ref} className={`editor-dialog ${wide ? "is-wide" : ""} ${anchor ? "is-anchored" : ""} ${className}`} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }} {...backdrop}>
    <div className="editor-dialog-inner"><header><h2>{title}</h2><button type="button" aria-label="Chiudi" title="Chiudi (Esc)" onClick={onClose}><X size={19} /></button></header>{children}</div>
  </dialog>;
}

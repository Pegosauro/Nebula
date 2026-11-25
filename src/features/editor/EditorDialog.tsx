import { useEffect, useRef, type ReactNode } from "react";
import { useBackdropDismiss } from "../../components/ui/popupDismissal";
import { X } from "lucide-react";

export function EditorDialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropDismiss(ref, onClose);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} className={`editor-dialog ${wide ? "is-wide" : ""}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} {...backdrop}>
    <div className="editor-dialog-inner"><header><h2>{title}</h2><button type="button" aria-label="Chiudi" title="Chiudi (Esc)" onClick={onClose}><X size={19} /></button></header>{children}</div>
  </dialog>;
}

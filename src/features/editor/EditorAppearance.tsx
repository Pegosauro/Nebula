import { useEffect, useRef, useState } from "react";
import { Type, X } from "lucide-react";
import { useSettingsStore } from "../settings/settingsStore";

export function EditorAppearance() {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const fontSize = useSettingsStore(state => state.editorFontSize);
  const pageWidth = useSettingsStore(state => state.editorPageWidth);
  const fullWidth = useSettingsStore(state => state.editorFullWidth);
  const setFontSize = useSettingsStore(state => state.setEditorFontSize);
  const setPageWidth = useSettingsStore(state => state.setEditorPageWidth);
  const setFullWidth = useSettingsStore(state => state.setEditorFullWidth);
  useEffect(() => {
    if (!open) return;
    host.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div ref={host} className="editor-appearance" onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); } }}>
    <button ref={trigger} type="button" className="button button-secondary" aria-label="Aspetto della pagina" title="Aspetto della pagina: testo e larghezza" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><Type size={17} /></button>
    {open && <div className="editor-appearance-panel" role="dialog" aria-label="Aspetto della pagina">
      <header><strong>Aspetto della pagina</strong><button type="button" aria-label="Chiudi aspetto pagina" onClick={close}><X size={16} /></button></header>
      <label><span>Dimensione del testo <output>{fontSize} px</output></span><input type="range" aria-label="Dimensione del testo" min={14} max={24} step={1} value={fontSize} onChange={event => setFontSize(Number(event.target.value))} /></label>
      <label><span>Larghezza della pagina <output>{fullWidth ? "Tutta" : `${pageWidth} px`}</output></span><input type="range" aria-label="Larghezza della pagina" min={560} max={1200} step={20} value={pageWidth} disabled={fullWidth} onChange={event => setPageWidth(Number(event.target.value))} /></label>
      <label className="appearance-full-width"><input type="checkbox" checked={fullWidth} onChange={event => setFullWidth(event.target.checked)} />Usa tutta la larghezza</label>
      <footer><span>Vale per Scrivi e lettura.</span><button type="button" onClick={() => { setFontSize(17); setPageWidth(780); setFullWidth(false); }}>Ripristina</button></footer>
    </div>}
  </div>;
}

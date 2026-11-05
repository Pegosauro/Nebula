import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { findText } from "./markdownTools";
import type { EditorApi } from "./editorCommands";
export function EditorSearch({ content, api, onClose }: { content: string; api: EditorApi | null; onClose: () => void }) {
  const [query, setQuery] = useState(""), [replace, setReplace] = useState(""), [matchCase, setMatchCase] = useState(false), [whole, setWhole] = useState(false), [notice, setNotice] = useState("");
  const matches = useMemo(() => findText(content, query, matchCase, whole), [content, query, matchCase, whole]);
  const move = (direction: number) => {
    if (!matches.length || !api) return;
    const selection = api.getSelection(); const exact = matches.findIndex(m => m.from === selection.from && m.to === selection.to);
    const start = direction > 0 ? matches.findIndex(m => m.from >= selection.to) : matches.findLastIndex(m => m.to <= selection.from);
    const index = exact >= 0 ? (exact + direction + matches.length) % matches.length : start >= 0 ? start : direction > 0 ? 0 : matches.length - 1;
    const match = matches[index]!; api.select(match.from, match.to, false); setNotice(`Risultato ${index + 1} di ${matches.length}`);
  };
  return <div className="editor-search" role="search" aria-label="Cerca nella nota" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
    <div><input aria-label="Trova nella nota" placeholder="Trova nella nota…" autoFocus value={query} onChange={e => { setQuery(e.target.value); setNotice(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); move(e.shiftKey ? -1 : 1); } }} />
      <button type="button" aria-label="Risultato precedente" disabled={!matches.length} onClick={() => move(-1)}><ArrowUp size={17} /></button><button type="button" aria-label="Risultato successivo" disabled={!matches.length} onClick={() => move(1)}><ArrowDown size={17} /></button>
      <label><input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} />Aa</label><label><input type="checkbox" checked={whole} onChange={e => setWhole(e.target.checked)} />Parola intera</label><button type="button" aria-label="Chiudi ricerca" onClick={onClose}><X size={17} /></button></div>
    <div><input aria-label="Sostituisci con" placeholder="Sostituisci con…" value={replace} onChange={e => setReplace(e.target.value)} />
      <button type="button" disabled={!matches.length} onClick={() => {
        const selection = api?.getSelection(); const exact = matches.find(m => m.from === selection?.from && m.to === selection?.to);
        if (exact) { api?.replace(exact.from, exact.to, replace); setNotice("Occorrenza sostituita"); }
        else move(1);
      }}>Sostituisci</button><button type="button" disabled={!matches.length} onClick={() => { api?.replaceAll(matches.map(m => ({ ...m, insert: replace }))); setNotice(`${matches.length} sostituzioni. Ctrl/⌘ Z per annullare.`); }}>Sostituisci tutto</button>
      <span role="status">{notice || (query ? `${matches.length} risultati` : "Invio: successivo")}</span></div>
  </div>;
}

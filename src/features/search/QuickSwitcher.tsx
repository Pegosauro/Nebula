import { memo, useEffect, useId, useRef, useState } from "react";
import { FileText, LoaderCircle, Search, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { withoutMarkdownExtension } from "../../domain/path";
import { findVaultEntry } from "../../domain/vault";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useSearchStore } from "./searchStore";
import { quickCatalog, quickSearchClient } from "./quickSearchClient";

function openResult(path: string) {
  const snapshot = useVaultStore.getState().snapshot;
  const entry = snapshot ? findVaultEntry(snapshot.root, path) : undefined;
  if (!entry) return;
  useSearchStore.getState().closeQuickSwitcher();
  useWorkspaceStore.getState().openEntry(entry);
}

export function QuickSwitcher() {
  const open = useSearchStore(state => state.quickOpen);
  const root = useVaultStore(state => state.snapshot?.root);
  const documents = useKnowledgeStore(state => state.documents);
  useEffect(() => {
    quickSearchClient.replace(quickCatalog(root ?? [], documents));
    const search = useSearchStore.getState();
    if (search.quickOpen) void search.searchQuick(search.quickQuery);
  }, [root, documents]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!event.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "o") {
        event.preventDefault();
        if (!useSearchStore.getState().quickOpen) useSearchStore.getState().openQuickSwitcher();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  return open ? <QuickDialog /> : null;
}

function QuickDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null), inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), composing = useRef(false);
  const [draft, setDraft] = useState("");
  const query = useSearchStore(state => state.quickQuery);
  const searching = useSearchStore(state => state.quickSearching);
  const selectedIndex = useSearchStore(state => state.quickSelectedIndex);
  const hasSelection = useSearchStore(state => !!state.quickResults[state.quickSelectedIndex]);
  const id = useId(), busy = searching || draft !== query;
  const close = useSearchStore(state => state.closeQuickSwitcher);
  useEffect(() => {
    dialogRef.current?.showModal(); inputRef.current?.focus();
    return () => { clearTimeout(timer.current); };
  }, []);
  const schedule = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void useSearchStore.getState().searchQuick(value); }, 60);
  };
  const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || composing.current) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (busy) return;
      useSearchStore.getState().moveQuickSelection(event.key === "ArrowDown" ? 1 : -1);
      const index = useSearchStore.getState().quickSelectedIndex;
      dialogRef.current?.querySelector(`[id="${id}-option-${index}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault(); clearTimeout(timer.current);
      if (busy) await useSearchStore.getState().searchQuick(draft);
      const state = useSearchStore.getState();
      if (!state.quickOpen || state.quickSearching || state.quickQuery !== draft || inputRef.current?.value !== draft) return;
      const result = state.quickResults[state.quickSelectedIndex]; if (result) openResult(result.path);
    }
  };
  return <dialog ref={dialogRef} className="quick-switcher" aria-label="Apri una nota" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="quick-search-field">
      <Search size={18} aria-hidden="true" />
      <input ref={inputRef} value={draft} role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-results`} aria-activedescendant={!busy && hasSelection ? `${id}-option-${selectedIndex}` : undefined} autoComplete="off" spellCheck={false} placeholder="Apri rapidamente una nota…" aria-label="Quick Switcher"
        onChange={event => { const value = event.target.value; setDraft(value); if (!composing.current) schedule(value); }}
        onCompositionStart={() => { composing.current = true; clearTimeout(timer.current); }} onCompositionEnd={event => { composing.current = false; schedule(event.currentTarget.value); }} onKeyDown={onKeyDown} />
      {busy ? <LoaderCircle className="spin" size={16} aria-label="Ricerca in corso" /> : null}
      <IconButton label="Chiudi Quick Switcher" onClick={close}><X size={17} /></IconButton>
    </div>
    <QuickResults id={id} pending={busy} />
    <footer className="quick-footer"><span><kbd>↑↓</kbd> seleziona</span><span><kbd>↵</kbd> apri</span><span><kbd>Esc</kbd> chiudi</span></footer>
  </dialog>;
}

const QuickResults = memo(function QuickResults({ id, pending }: { id: string; pending: boolean }) {
  const results = useSearchStore(state => state.quickResults), query = useSearchStore(state => state.quickQuery);
  const selectedIndex = useSearchStore(state => state.quickSelectedIndex), error = useSearchStore(state => state.error);
  return <div id={`${id}-results`} className="quick-results" role="listbox" aria-label="Note disponibili" aria-busy={pending}>
    {!pending && error ? <div className="quick-empty" role="alert">{error}</div> : null}
    {!pending && !error && !results.length ? <div className="quick-empty"><Search size={20} /><span>{query ? "Nessuna nota corrispondente." : "Apri un Vault o inizia a digitare."}</span></div> : null}
    {results.map((result, index) => <button id={`${id}-option-${index}`} className={index === selectedIndex ? "is-selected" : ""} type="button" role="option" aria-selected={index === selectedIndex} aria-disabled={pending} tabIndex={-1} key={result.path}
      onClick={() => { if (!pending) openResult(result.path); }} onPointerMove={() => { if (!pending) useSearchStore.getState().setQuickSelectedIndex(index); }}>
      <FileText size={17} /><span><strong>{result.title}</strong><small>{withoutMarkdownExtension(result.path)}</small></span>{result.match === "recent" ? <em>Recente</em> : null}
    </button>)}
  </div>;
});

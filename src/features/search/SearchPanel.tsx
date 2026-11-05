import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Search, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { PanelHeader } from "../../components/ui/PanelHeader";
import type { SearchResult } from "../../domain/search";
import { findVaultEntry } from "../../domain/vault";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useSearchStore } from "./searchStore";

const matchLabel: Record<SearchResult["match"], string> = {
  title: "Titolo",
  path: "Percorso",
  alias: "Alias",
  tag: "Tag",
  content: "Contenuto",
  recent: "Recente",
};

export function SearchPanel() {
  const snapshot = useVaultStore((state) => state.snapshot);
  const vaultStatus = useVaultStore((state) => state.status);
  const indexStatus = useKnowledgeStore((state) => state.status);
  const progress = useKnowledgeStore((state) => state.progress);
  const total = useKnowledgeStore((state) => state.total);
  const query = useSearchStore((state) => state.query);
  const results = useSearchStore((state) => state.results);
  const searching = useSearchStore((state) => state.searching);
  const error = useSearchStore((state) => state.error);
  const search = useSearchStore((state) => state.search);
  const [draft, setDraft] = useState(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void search(draft), 140);
    return () => window.clearTimeout(timeout);
  }, [draft, search]);
  useEffect(() => setSelectedIndex(0), [results]);

  const open = (result: SearchResult) => {
    const entry = snapshot ? findVaultEntry(snapshot.root, result.path) : undefined;
    if (entry) useWorkspaceStore.getState().openEntry(entry, true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = results[selectedIndex];
      if (result) open(result);
    }
  };

  return (
    <section className="side-panel search-panel" aria-label="Ricerca nel Vault">
      <PanelHeader title="Cerca" eyebrow={indexStatus === "ready" ? `${total} note indicizzate` : undefined} />
      <div className="search-field">
        <Search size={15} aria-hidden="true" />
        <input ref={inputRef} type="search" value={draft} placeholder="Titolo, testo, percorso, tag…" aria-label="Cerca nel Vault" onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
        {searching ? <LoaderCircle className="spin" size={14} /> : draft ? <IconButton label="Cancella ricerca" onClick={() => setDraft("")}><X size={14} /></IconButton> : null}
      </div>
      {indexStatus === "indexing" ? (
        <div className="search-index-progress" role="status">
          <span><LoaderCircle className="spin" size={14} />Indicizzazione {progress}/{total}</span>
          <progress max={Math.max(total, 1)} value={progress} />
        </div>
      ) : null}
      <div className="search-results" role="listbox" aria-label="Risultati di ricerca">
        {vaultStatus !== "ready" ? <SearchEmpty title="Apri un Vault" copy="La ricerca usa esclusivamente i file Markdown della cartella locale." /> : null}
        {vaultStatus === "ready" && !draft ? <SearchEmpty title="Cerca nel Vault" copy="Trova note per titolo, percorso, alias, tag o contenuto. Premi Ctrl/⌘ O per il Quick Switcher." /> : null}
        {vaultStatus === "ready" && draft && !searching && !results.length && !error ? <SearchEmpty title="Nessun risultato" copy={`Nessuna nota corrisponde a “${draft}”.`} /> : null}
        {error ? <SearchEmpty title="Ricerca non disponibile" copy={error} /> : null}
        {results.map((result, index) => (
          <button className={`search-result ${index === selectedIndex ? "is-selected" : ""}`} type="button" role="option" aria-selected={index === selectedIndex} key={result.path} onClick={() => open(result)} onPointerEnter={() => setSelectedIndex(index)}>
            <FileText size={15} />
            <span className="search-result-copy">
              <span className="search-result-heading"><strong>{result.title}</strong><small>{matchLabel[result.match]}</small></span>
              <span className="search-result-path">{result.breadcrumb}</span>
              <span className="search-result-snippet">{result.snippet}</span>
              {result.tags.length ? <span className="search-result-tags">{result.tags.slice(0, 3).map((tag) => <em key={tag}>#{tag}</em>)}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchEmpty({ title, copy }: { title: string; copy: string }) {
  return <div className="panel-empty search-empty"><Search size={27} /><strong>{title}</strong><span>{copy}</span></div>;
}

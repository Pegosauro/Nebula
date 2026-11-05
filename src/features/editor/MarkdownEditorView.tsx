import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { useQuickNoteUiStore } from "../notes/quickNoteUiStore";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Files, FileText, LoaderCircle, RefreshCw, Save, TriangleAlert, Undo2, Code2, Pencil, X, LockKeyhole, LockKeyholeOpen, Maximize2, Minimize2, SlidersHorizontal, NotebookPen, Download } from "lucide-react";
import { dirname, withoutMarkdownExtension } from "../../domain/path";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useDocumentStore } from "./documentStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { normalizeEditorMode, type EditorMode } from "./editorMode";
import { editorCacheGeneration, getEditorMemory, rememberEditor } from "./editorSessionCache";
import { EditorAppearance } from "./EditorAppearance";
import { NoteLinkPreview } from "./NoteLinkPreview";
import { EditorToolbar } from "./EditorToolbar";
import { ImagePanel, InsertPanel, LinkPanel, TablePanel } from "./EditorPanels";
import { EditorSearch } from "./EditorSearch";
import type { EditorApi, EditorPanel, EditorUiState } from "./editorCommands";
import { markdownTables, type MarkdownTable } from "./markdownTools";
import type { InsertCommand } from "./insertCommands";
import { vaultService } from "../vault/vaultService";
import { useVaultStore } from "../vault/vaultStore";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { useSettingsStore } from "../settings/settingsStore";
import { NotePropertiesPanel } from "../notes/NotePropertiesPanel";
import { useDocumentStats } from "./documentStats";
import { toggleMarkdownTask } from "./markdownTasks";
import CodeMirrorEditor from "./CodeMirrorEditor";
import { SaveTemplateDialog } from "../templates/SaveTemplateDialog";
import { QuickNoteOrganizer } from "../notes/QuickNoteOrganizer";
import { QUICK_NOTES_PATH } from "../notes/quickNotes";
import { NoteTitle } from "./NoteTitle";

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));
function statusCopy(status?: string): string {
  if (status === "dirty") return "Modifiche da salvare";
  if (status === "saving") return "Salvataggio…";
  if (status === "error") return "Salvataggio non riuscito";
  if (status === "conflict") return "Conflitto con il file su disco";
  if (status === "loading") return "Apertura…";
  return "Salvato automaticamente";
}
export default function MarkdownEditorView() {
  const activeTabId = useWorkspaceStore(state => state.activeTabId);
  const tab = useWorkspaceStore(state => state.tabs.find(item => item.id === activeTabId));
  // A key scopes all editor-local UI to the document; CodeMirror state is cached separately.
  return tab?.path ? <DocumentEditor key={tab.path} path={tab.path} title={tab.title} newlyCreated={tab.newlyCreated} tabId={tab.id} /> : null;
}
function imageMarkdown(reference: string, alt: string) {
  const label = alt.replace(/([\[\]\\])/g, "\\$1").replace(/\r?\n/g, " ");
  return `![${label}](${reference.replace(/[\s()<>]/g, c => `%${c.charCodeAt(0).toString(16)}`)})`;
}
function DocumentEditor({ path, title, newlyCreated, tabId }: { path: string; title: string; newlyCreated?: boolean; tabId: string }) {
  const session = useDocumentStore(state => state.sessions[path]);
  const indexedSuggestions = useKnowledgeStore(state => state.suggestions);
  const vaultRevision = useVaultStore(state=>state.snapshot?.scannedAt);
  const suggestions = useMemo(()=>navigationKnowledge().suggestions,[indexedSuggestions,vaultRevision]);
  const showMarkdownAtCursor = useSettingsStore(state => state.showMarkdownAtCursor);
  const fontSize = useSettingsStore(state => state.editorFontSize);
  const pageWidth = useSettingsStore(state => state.editorPageWidth);
  const fullWidth = useSettingsStore(state => state.editorFullWidth);
  const defaultProperties = useSettingsStore(state => state.showNotePropertiesByDefault);
  const [propertiesVisible, setPropertiesVisible] = useState(() => getEditorMemory(path)?.propertiesVisible ?? defaultProperties);
  const toggleProperties = (visible = !propertiesVisible) => { rememberEditor(path, { propertiesVisible: visible }, epoch.current); setPropertiesVisible(visible); };
  const defaultMode = useSettingsStore(state => state.editorDefaultMode);
  const [mode, setModeState] = useState<EditorMode>(() => normalizeEditorMode(getEditorMemory(path)?.mode ?? (newlyCreated ? "edit" : defaultMode)));
  const [locked, setLocked] = useState(() => getEditorMemory(path)?.locked ?? false);
  const epoch = useRef(editorCacheGeneration());
  const api = useRef<EditorApi | null>(null);
  const [ui, setUi] = useState<EditorUiState>();
  const [panel, setPanel] = useState<EditorPanel | null>(null), [search, setSearch] = useState(false), [focus, setFocus] = useState(false);
  const [editingTable, setEditingTable] = useState<MarkdownTable>();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [exportingPdf,setExportingPdf] = useState(false);
  const exportPdf = async () => { if (!session || exportingPdf) return; setExportingPdf(true); try { const {exportPagePdf}=await import("./exportPagePdf"); const missing=await exportPagePdf(session.content,title,path); if(alive.current)setNotice(missing ? `Esportazione preparata: ${missing} immagini non disponibili sono segnalate nel documento. Scegli Salva come PDF nella finestra di stampa.` : "Scegli Salva come PDF nella finestra di stampa."); } catch(e) { if(alive.current)setNotice(e instanceof Error ? e.message : "Esportazione PDF non riuscita."); } finally { if(alive.current)setExportingPdf(false); } };
  const area = useRef<HTMLElement>(null), alive = useRef(true);
  const toggleLock = () => {
    if (busy) return;
    const next = !locked;
    rememberEditor(path, { locked: next }, epoch.current);
    setPanel(null); setSearch(false); setLocked(next);
  };
  const setMode = (next: EditorMode) => { if (locked) return; rememberEditor(path, { mode: next }, epoch.current); setModeState(next); };
  useEffect(() => {
    alive.current = true; void useDocumentStore.getState().open(path);
    if (newlyCreated) useWorkspaceStore.getState().markCreationHandled(tabId);
    return () => { alive.current = false; };
  }, [path]);
  const change = useCallback((content: string) => useDocumentStore.getState().updateContent(path, content), [path]);
  const toggleTask = useCallback((from: number, checked: boolean, expectedContent: string) => {
    const store = useDocumentStore.getState(), current = store.sessions[path];
    if (!current?.loaded || current.operationLocked || current.status === "conflict" || current.content !== expectedContent) return;
    store.updateContent(path, toggleMarkdownTask(current.content, from, checked));
  }, [path]);
  const openTable = useCallback((table: MarkdownTable) => { if (!locked) { setEditingTable(table); setPanel("table"); } }, [locked]);
  const openPanel = (next: EditorPanel) => {
    if (locked) return;
    if (next === "search") { setSearch(true); return; }
    if (next === "table") {
      const at = api.current?.getSelection().from ?? 0;
      setEditingTable(markdownTables(session?.content ?? "").find(table => at >= table.from && at <= table.to));
    }
    setPanel(next);
  };
  const closePanel = () => { setPanel(null); requestAnimationFrame(() => api.current?.focus()); };
  const onCommand = (command: InsertCommand) => {
    if (locked) return;
    if (command.panel) { openPanel(command.panel); return; }
    if (command.format) api.current?.format(command.format); else if (command.text) api.current?.insert(command.text, true); closePanel();
  };
  const insertImages = async (files: File[]) => {
    if (locked || busy || !api.current) return; setBusy(true); setPanel(null); setNotice("Copia delle immagini nel Vault…");
    const editor = api.current;
    const imported: string[] = [];
    try {
      for (const file of files) {
        if (!alive.current) break;
        const reference = await vaultService.saveImage(path, file);
        imported.push(imageMarkdown(reference, file.name.replace(/\.[^.]*$/, "")));
      }
      if (alive.current && imported.length) { editor.insert(imported.join("\n\n"), true); setNotice(`${imported.length === 1 ? "Immagine salvata" : `${imported.length} immagini salvate`} nel Vault`); }
    } catch (e) {
      if (alive.current) { if (imported.length) { editor.insert(imported.join("\n\n"), true); } setNotice(e instanceof Error ? e.message : "Impossibile inserire l’immagine."); }
    } finally { if (alive.current) setBusy(false); }
  };
  useEffect(() => {
    const navigate = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; from: number }>).detail;
      if (detail.path !== path) return;
      if (locked) area.current?.querySelector<HTMLElement>(`[data-heading-from="${detail.from}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      else api.current?.select(detail.from);
    };
    window.addEventListener("nebula:heading", navigate);
    return () => window.removeEventListener("nebula:heading", navigate);
  }, [locked, path]);
  const counts = useDocumentStats(path, session?.content);
  if (!session || session.status === "loading") return <div className="editor-loading"><LoaderCircle className="spin" size={24} /><span>Apertura di {title}…</span></div>;
  if (!session.loaded) return <div className="editor-fatal" role="alert"><AlertTriangle size={26} /><h1>Impossibile aprire la nota</h1><p>{session.error}</p><button type="button" className="button button-secondary" onClick={() => void useDocumentStore.getState().open(path)}>Riprova</button></div>;
  return <section ref={area} style={{ "--note-font-size": `${fontSize / 16}rem`, "--note-width": fullWidth ? "100%" : `${pageWidth}px` } as CSSProperties} className={`markdown-editor editor-v2 ${locked ? "is-locked" : ""} ${focus ? "editor-focus" : ""}`} aria-label={`Editor ${title}`} onKeyDown={event => {
    if (event.key === "Escape" && focus && !panel) { event.stopPropagation(); setFocus(false); }
    if (event.key === "s" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!session.operationLocked && session.status !== "conflict") void useDocumentStore.getState().save(path); }
  }}>
    <header className="editor-header"><div className="editor-title-block"><div className="document-breadcrumb">{withoutMarkdownExtension(path)}</div><div className="editor-title"><FileText size={20} /><NoteTitle path={path} title={title} disabled={locked || busy || !!session.operationLocked || session.status === "conflict"} /></div></div>
      <div className="editor-header-actions"><div className="editor-mode" role="group" aria-label="Modalità documento">{([{ id: "edit", label: "Scrivi", icon: Pencil }, { id: "source", label: "Sorgente", icon: Code2 }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} disabled={locked} aria-pressed={(locked ? "edit" : mode) === id} className={(locked ? "edit" : mode) === id ? "is-active" : ""} onClick={() => setMode(id)}><Icon size={15} />{label}</button>)}</div>
        {focus && <button className="button button-secondary" type="button" aria-label="Nota veloce" title="Nota veloce" onClick={() => useQuickNoteUiStore.getState().show()}><NotebookPen size={18} /></button>}
        <EditorAppearance />
        <button className="button button-secondary editor-pdf" type="button" disabled={exportingPdf} aria-label="Esporta pagina in PDF" title="Esporta la pagina in PDF tramite la stampa del dispositivo" onClick={()=>void exportPdf()}>{exportingPdf ? <LoaderCircle size={17} className="spin"/> : <Download size={17}/>}<span>PDF</span></button>
        <button className="button button-secondary editor-properties-toggle" type="button" aria-expanded={propertiesVisible} aria-controls="note-properties" onClick={() => toggleProperties()}><SlidersHorizontal size={17} /><span>Proprietà</span></button>
        <button className="button button-secondary editor-template" type="button" disabled={busy} aria-label="Salva come modello" title="Salva questa nota come modello personale" onClick={() => setSavingTemplate(true)}><Files size={17} /><span>Modello</span></button>
        <button className={`button button-secondary editor-lock ${locked ? "is-active" : ""}`} type="button" disabled={busy} aria-pressed={locked} aria-label={locked ? "Sblocca pagina" : "Blocca pagina"} title={locked ? "Sblocca per modificare" : "Blocca in sola lettura"} onClick={toggleLock}>{locked ? <LockKeyhole size={17} /> : <LockKeyholeOpen size={17} />}<span>{locked ? "Sola lettura" : "Blocca"}</span></button>
        {locked && <button className="button button-secondary" type="button" aria-label={focus ? "Esci da Concentrazione" : "Concentrazione"} onClick={() => setFocus(value => !value)}>{focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
        <button className="button button-secondary editor-save" type="button" disabled={locked || session.status === "saving" || session.status === "saved" || session.status === "conflict"} onClick={() => void useDocumentStore.getState().save(path)} aria-label="Salva nota" title="Salva (Ctrl/⌘ S)">{session.status === "saving" ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}</button>
      </div>
    </header>
    {propertiesVisible && <NotePropertiesPanel content={session.content} readOnly={locked || !!session.operationLocked} onChange={change} onHide={() => toggleProperties(false)} />}
    {path === QUICK_NOTES_PATH && <QuickNoteOrganizer content={session.content} disabled={!!session.operationLocked || session.status === "conflict"} onCompleted={setNotice} />}
    {!locked && <EditorToolbar api={api.current} state={ui} onPanel={openPanel} focus={focus} onFocus={() => setFocus(value => !value)} />}
    {!locked && search && <EditorSearch content={session.content} api={api.current} onClose={() => { setSearch(false); api.current?.focus(); }} />}
    {session.status === "conflict" ? <div className="editor-alert is-conflict" role="alert"><TriangleAlert size={20} /><div><strong>Il file è cambiato anche fuori da Nebula</strong><p>{session.error}</p></div><button className="button button-secondary" type="button" disabled={locked} onClick={() => void useDocumentStore.getState().reloadFromDisk(path)}><Undo2 size={15} />Ricarica da disco</button><button className="button button-primary" type="button" disabled={locked} onClick={() => void useDocumentStore.getState().forceSave(path)}><Save size={15} />Mantieni Nebula</button></div>
      : session.status === "error" ? <div className="editor-alert" role="alert"><AlertTriangle size={20} /><div><strong>Il testo è ancora nell’editor</strong><p>{session.error}</p></div><button className="button button-secondary" type="button" onClick={() => void useDocumentStore.getState().save(path)}>Riprova</button></div> : null}
    {session.externalReloadedAt && session.status === "saved" && <div className="editor-reloaded" role="status"><RefreshCw size={14} />File aggiornato dalla versione presente sul disco.</div>}
    {notice && <div className="editor-notice" role="status">{busy && <LoaderCircle size={15} className="spin" />}<span>{notice}</span>{!busy && <button type="button" aria-label="Chiudi messaggio" onClick={() => setNotice("")}><X size={14} /></button>}</div>}
    <div className="editor-surface"><Suspense fallback={<div className="editor-loading"><LoaderCircle className="spin" size={20} /><span>Preparazione documento…</span></div>}>
      <div className="editor-write-surface" hidden={locked}><CodeMirrorEditor path={path} showMarkdownAtCursor={showMarkdownAtCursor} value={session.content} source={mode === "source"} visible={!locked} readOnly={locked || !!session.operationLocked} appearanceKey={`${fontSize}:${pageWidth}:${fullWidth}`} apiRef={api} onChange={change} suggestions={suggestions} onSave={() => void useDocumentStore.getState().save(path)} onOpenLink={target => useKnowledgeNavigationStore.getState().activate(path, target)} onUiChange={setUi} onPanel={openPanel} onImages={files => void insertImages(files)} onTable={openTable} /></div>
      {locked && <MarkdownPreview content={session.content} sourcePath={path} readOnly onTaskToggle={session.operationLocked || session.status === "conflict" ? undefined : toggleTask} />}
    </Suspense></div>
    {!locked && ui?.selected && ui.x > 0 && !panel && !search && <div className="floating-format-position" style={{ left: Math.max(8, Math.min(ui.x - 110, window.innerWidth - 246)), top: Math.max(8, ui.y - 46) }}><EditorToolbar api={api.current} state={ui} onPanel={openPanel} focus={focus} onFocus={() => {}} floating /></div>}
    <NoteLinkPreview sourcePath={path} root={area} />
    <footer className={`editor-statusbar is-${session.status}`}><span role="status">{session.status === "saved" ? <Check size={14} /> : session.status === "saving" ? <LoaderCircle size={14} className="spin" /> : <span className="dirty-dot" />}{statusCopy(session.status)}</span><span>{counts.words} parole · {counts.characters} caratteri</span>{locked ? <span><LockKeyhole size={13} />Testo bloccato · Attività selezionabili</span> : <span>Riga {ui?.line ?? 1}, col {ui?.column ?? 1}</span>}</footer>
    {(panel === "insert" || panel === "help") && <InsertPanel help={panel === "help"} onCommand={onCommand} onClose={closePanel} />}
    {panel === "link" && <LinkPanel suggestions={suggestions} selectedText={api.current?.getSelection().text ?? ""} onInsert={text => { api.current?.insert(text); closePanel(); }} onClose={closePanel} onCreate={async name => {
      return useVaultStore.getState().createNote(dirname(path), name, false);
    }} />}
    {panel === "image" && <ImagePanel onClose={closePanel} onFiles={files => void insertImages(files)} onReference={(reference, alt) => {
      try { if (!/^https?:\/\//i.test(reference)) resolveImagePath(path, reference); api.current?.insert(imageMarkdown(reference, alt), true); closePanel(); }
      catch (error) { setNotice(error instanceof Error ? error.message : "Percorso non valido"); closePanel(); }
    }} />}
    {panel === "table" && <TablePanel table={editingTable} onClose={closePanel} onSave={text => {
      if (editingTable) api.current?.replace(editingTable.from, editingTable.to, text); else { api.current?.insert(text, true); }
      closePanel();
    }} />}
    {savingTemplate ? <SaveTemplateDialog title={title} content={session.content} sourcePath={path} hasUnsavedChanges={session.content !== session.savedContent} onClose={() => setSavingTemplate(false)} onSaved={setNotice} /> : null}
  </section>;
}

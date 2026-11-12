import { create } from "zustand";
import { isPathInside } from "../../domain/path";
import { findVaultEntry } from "../../domain/vault";
import { ExternalFileConflictError, type ExpectedFileMetadata } from "../../infrastructure/filesystem/vaultFileOperations";
import { vaultService } from "../vault/vaultService";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { inspectTree, parseTree, type Tree } from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";

export interface TreeEdit { label?: string; group?: string }
interface HistoryEntry { data: Tree; label: string }
interface Session { data: Tree; saved: string; expected: ExpectedFileMetadata; error?: string; conflict: boolean; saving: boolean; undoStack: HistoryEntry[]; redoStack: HistoryEntry[]; historyGroup?: { key: string; at: number } }
interface State {
  sessions: Record<string, Session>;
  load: (path: string, force?: boolean) => Promise<void>;
  edit: (path: string, data: Tree, edit?: TreeEdit) => void;
  applyMove: (path: string, data: Tree) => void;
  applyDelete: (path: string, data: Tree) => void;
  undo: (path: string) => boolean;
  redo: (path: string) => boolean;
  endEditGroup: (path: string) => void;
  save: (path: string) => Promise<boolean>;
  flush: (path?: string) => Promise<boolean>;
  reset: () => void;
  remap: (oldPath: string, newPath: string) => void;
  remove: (path: string) => void;
  create: (tree: Tree) => Promise<string>;
  checkExternalChanges: () => Promise<void>;
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const loading = new Map<string, Promise<void>>();
const saves = new Map<string, Promise<boolean>>();
const loadEpochs = new Map<string, number>();
let generation = 0;

function dirty(session: Session | undefined): boolean {
  return Boolean(session && serializeTree(session.data) !== session.saved);
}

type Setter = (partial: Partial<State> | ((state: State) => Partial<State>)) => void;
const HISTORY_LIMIT = 100;
const HISTORY_BYTES = 8 * 1024 * 1024;
function boundedHistory(entries: HistoryEntry[]): HistoryEntry[] {
  let bytes = 0;
  let start = entries.length;
  while (start > 0 && entries.length - start < HISTORY_LIMIT) {
    const size = serializeTree(entries[start - 1]!.data).length * 2;
    if (start < entries.length && bytes + size > HISTORY_BYTES) break;
    bytes += size; start -= 1;
  }
  return entries.slice(start);
}
function scheduleSave(get: () => State, path: string) {
  clearTimeout(timers.get(path)); timers.delete(path);
  if (get().sessions[path]?.conflict) return;
  timers.set(path, setTimeout(() => { timers.delete(path); void get().save(path); }, 700));
}
function commitSession(set: Setter, get: () => State, path: string, data: Tree, edit: TreeEdit = {}) {
  const session = get().sessions[path];
  if (!session || data === session.data || serializeTree(data) === serializeTree(session.data)) return;
  const now = Date.now();
  const grouped = Boolean(edit.group && session.historyGroup?.key === edit.group && now - session.historyGroup.at < 1000 && !session.redoStack.length);
  const next: Session = { ...session, data, error: session.conflict ? session.error : undefined,
    undoStack: grouped ? session.undoStack : boundedHistory([...session.undoStack, { data: session.data, label: edit.label ?? "Modifica struttura" }]), redoStack: [],
    historyGroup: edit.group ? { key: edit.group, at: now } : undefined };
  set(state => ({ sessions: { ...state.sessions, [path]: next } }));
  scheduleSave(get, path);
}
function travelHistory(set: Setter, get: () => State, path: string, redo: boolean): boolean {
  const session = get().sessions[path];
  const stack = redo ? session?.redoStack : session?.undoStack;
  const entry = stack?.at(-1);
  if (!session || !entry) return false;
  const current: HistoryEntry = { data: session.data, label: entry.label };
  const next: Session = { ...session, data: entry.data, error: session.conflict ? session.error : undefined, historyGroup: undefined,
    undoStack: redo ? boundedHistory([...session.undoStack, current]) : session.undoStack.slice(0, -1),
    redoStack: redo ? session.redoStack.slice(0, -1) : boundedHistory([...session.redoStack, current]) };
  set(state => ({ sessions: { ...state.sessions, [path]: next } }));
  scheduleSave(get, path);
  return true;
}

export const useTreeStore = create<State>((set, get) => ({
  sessions: {},
  load: async (path, force = false) => {
    if (force) { clearTimeout(timers.get(path)); timers.delete(path); }
    if (loading.has(path)) return loading.get(path);
    const currentGeneration = generation;
    const loadEpoch = loadEpochs.get(path) ?? 0;
    const task = (async () => {
      const existing = get().sessions[path];
      if (saves.has(path)) await saves.get(path);
      const snapshot = await vaultService.readText(path);
      if (!force && existing) {
        const latest = get().sessions[path];
        if (snapshot.size === latest?.expected.size && snapshot.lastModified === latest.expected.lastModified) return;
        if (latest && (dirty(latest) || latest.conflict)) throw new Error("Il file è stato modificato da un'altra applicazione. Esporta la bozza o ricarica dal Vault.");
      }
      const data = parseTree(snapshot.content);
      if (currentGeneration !== generation || loadEpoch !== (loadEpochs.get(path) ?? 0)) return;
      set(state => ({ sessions: { ...state.sessions, [path]: { data, saved: serializeTree(data), expected: { size: snapshot.size, lastModified: snapshot.lastModified }, saving: false, conflict: false, undoStack: [], redoStack: [] } } }));
    })();
    loading.set(path, task);
    try { await task; } finally { if (loading.get(path) === task) loading.delete(path); }
  },
  edit: (path, data, edit) => { commitSession(set, get, path, data, edit); },
  applyMove: (path, data) => { commitSession(set, get, path, data, { label: "Spostamento" }); },
  applyDelete: (path, data) => { commitSession(set, get, path, data, { label: "Eliminazione" }); },
  undo: path => travelHistory(set, get, path, false),
  redo: path => travelHistory(set, get, path, true),
  endEditGroup: path => set(state => {
    const session = state.sessions[path];
    return session?.historyGroup ? { sessions: { ...state.sessions, [path]: { ...session, historyGroup: undefined } } } : state;
  }),
  save: async path => {
    clearTimeout(timers.get(path));
    timers.delete(path);
    const previous = saves.get(path);
    if (previous) { if (!await previous) return false; return get().save(path); }
    const session = get().sessions[path];
    if (!session || session.conflict) return !session?.conflict;
    if (serializeTree(session.data) === session.saved) return true;
    const currentGeneration = generation;
    const report = inspectTree(session.data);
    if (report.errors.length) {
      set(state => ({ sessions: { ...state.sessions, [path]: { ...state.sessions[path]!, saving: false, conflict: false, error: report.errors.map(issue => issue.message).join("\n") } } }));
      return false;
    }
    const content = serializeTree(session.data);
    const task = (async () => {
      set(state => ({ sessions: { ...state.sessions, [path]: { ...state.sessions[path]!, saving: true, error: undefined } } }));
      try {
        parseTree(serializeTreeFile(session.data));
        const expected = await vaultService.writeText(path, serializeTreeFile(session.data), session.expected);
        if (generation === currentGeneration) set(state => ({ sessions: { ...state.sessions, [path]: { ...state.sessions[path]!, saved: content, expected, saving: false, conflict: false } } }));
        return true;
      } catch (error) {
        const conflict = error instanceof ExternalFileConflictError;
        if (generation === currentGeneration) set(state => ({ sessions: { ...state.sessions, [path]: { ...state.sessions[path]!, saving: false, conflict, error: error instanceof Error ? error.message : "Salvataggio non riuscito." } } }));
        return false;
      }
    })();
    saves.set(path, task);
    try { return await task; } finally { if (saves.get(path) === task) saves.delete(path); }
  },
  flush: async path => {
    const paths = Object.keys(get().sessions).filter(item => !path || isPathInside(item, path));
    for (const item of paths) {
      let clean = false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (!await get().save(item)) return false;
        const session = get().sessions[item];
        if (!session || serializeTree(session.data) === session.saved) { clean = true; break; }
      }
      if (!clean) return false;
    }
    return true;
  },
  reset: () => { generation += 1; for (const timer of timers.values()) clearTimeout(timer); timers.clear(); loading.clear(); saves.clear(); loadEpochs.clear(); set({ sessions: {} }); },
  remap: (oldPath, newPath) => set(state => ({ sessions: Object.fromEntries(Object.entries(state.sessions).map(([path, session]) => [isPathInside(path, oldPath) ? `${newPath}${path.slice(oldPath.length)}` : path, session])) })),
  remove: path => {
    for (const [item, timer] of timers) if (isPathInside(item, path)) { clearTimeout(timer); timers.delete(item); }
    for (const item of new Set([...loading.keys(), ...Object.keys(get().sessions)])) if (isPathInside(item, path)) { loadEpochs.set(item, (loadEpochs.get(item) ?? 0) + 1); loading.delete(item); }
    set(state => ({ sessions: Object.fromEntries(Object.entries(state.sessions).filter(([item]) => !isPathInside(item, path))) }));
  },
  create: async tree => {
    const result = await vaultService.createTree(tree.title, serializeTreeFile(tree));
    useVaultStore.setState({ snapshot: result.snapshot });
    const entry = findVaultEntry(result.snapshot.root, result.path);
    if (entry) useWorkspaceStore.getState().openEntry(entry, true);
    return result.path;
  },
  checkExternalChanges: async () => {
    for (const path of Object.keys(get().sessions)) {
      try { await get().load(path); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Verifica del file non riuscita.";
        set(state => {
          const session = state.sessions[path];
          return session ? { sessions: { ...state.sessions, [path]: { ...session, conflict: message.includes("modificato"), error: message } } } : state;
        });
      }
    }
  },
}));

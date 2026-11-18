import { createStore } from "zustand/vanilla";
import { vaultService } from "../vault/vaultService";
import { emptyBoard, readTaskBoard, remapTaskNotes, type TaskBoard, type TaskFilter } from "./taskModel";
import { TaskFileConflict } from "./taskFile";

type BoardState = {
  board?: TaskBoard;
  status: "loading" | "ready" | "saving" | "error" | "conflict";
  error?: string;
};
type TaskFile = ReturnType<typeof vaultService.taskFile>;

export function createTaskSession(file: TaskFile, collapsed: string[] = []) {
  const store = createStore<BoardState>(() => ({ status: "loading" }));
  const layout = createStore<{ view: "list" | "matrix"; group: string; filter: TaskFilter; selectedId?: string; collapsed: string[] }>(() => ({
    view: "list", group: "", filter: "all", collapsed,
  }));
  let saved: string | null = null;
  let reading: Promise<void> | undefined;
  let writing: Promise<void> | undefined;

  function report(error: unknown) {
    store.setState({ status: error instanceof TaskFileConflict ? "conflict" : "error", error: error instanceof Error ? error.message : "Impossibile accedere alle task." });
  }

  function load() {
    if (!reading) {
      store.setState({ status: "loading", error: undefined });
      reading = file.read().then(content => {
        const board = content === null ? emptyBoard : readTaskBoard(content);
        saved = content;
        store.setState({ board, status: "ready" });
      }).catch(report).finally(() => { reading = undefined; });
    }
    return reading;
  }

  function save() {
    if (writing || !store.getState().board) return writing;
    store.setState({ status: "saving", error: undefined });
    writing = (async () => {
      while (true) {
        const board = store.getState().board;
        const content = JSON.stringify(board, null, 2) + "\n";
        if (content !== saved) await file.write(content, saved);
        saved = content;
        if (board === store.getState().board) break;
      }
      store.setState({ status: "ready" });
    })().catch(report).finally(() => { writing = undefined; });
    return writing;
  }

  function change(update: (board: TaskBoard) => TaskBoard) {
    const previous = store.getState().board;
    if (!previous || store.getState().status === "loading") return;
    const board = update(previous);
    if (board === previous) return;
    store.setState({ board });
    if (store.getState().status !== "error" && store.getState().status !== "conflict") void save();
  }

  return { store, layout, load, save, change };
}

const sessions = new Map<string, ReturnType<typeof createTaskSession>>();

export function taskSession(vaultId: string) {
  let session = sessions.get(vaultId);
  if (!session) {
    const key = `nebula.tasks.collapsed.${vaultId}`;
    let collapsed: string[] = [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(value)) collapsed = value.filter((id): id is string => typeof id === "string");
    } catch { /* Preferences are optional. */ }
    session = createTaskSession(vaultService.taskFile(vaultId), collapsed);
    session.layout.subscribe((state, previous) => {
      if (state.collapsed === previous.collapsed) return;
      try { localStorage.setItem(key, JSON.stringify(state.collapsed)); } catch { /* Keep the state for this session. */ }
    });
    sessions.set(vaultId, session);
    void session.load();
  }
  return session;
}

export async function updateLinkedTaskPaths(vaultId: string, oldPath: string, newPath: string) {
  const session = taskSession(vaultId);
  if (session.store.getState().status === "loading") await session.load();
  session.change(board => remapTaskNotes(board, oldPath, newPath));
  if (session.store.getState().status === "saving") await session.save();
}

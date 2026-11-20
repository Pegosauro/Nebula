import { create } from "zustand";
import { isPathInside } from "../../domain/path";

interface OpenedDocument { path: string; openedAt: number }
interface HomeDocuments { recent: OpenedDocument[]; pinned: string[] }

export const homePinLimit = 3;
const historyLimit = 20;
export const emptyHomeDocuments: HomeDocuments = { recent: [], pinned: [] };

function storageKey(id: string) {
  // The work copy and the primary directory belong to the same logical Vault.
  return `nebula.home-documents.v1.${id.replace(/:backup$/, "")}`;
}

function read(key: string): HomeDocuments {
  try {
    const record = JSON.parse(localStorage.getItem(key) ?? "{}");
    const recent = Array.isArray(record?.recent) ? record.recent.filter((value: unknown): value is OpenedDocument => {
      if (!value || typeof value !== "object") return false;
      const item = value as Partial<OpenedDocument>;
      return typeof item.path === "string" && typeof item.openedAt === "number" && item.openedAt >= 0 && item.openedAt <= 8.64e15;
    }).slice(0, historyLimit) : [];
    const pinned = Array.isArray(record?.pinned) ? [...new Set<string>(record.pinned.filter((path: unknown) => typeof path === "string"))].slice(0, homePinLimit) : [];
    return { recent, pinned };
  } catch { return emptyHomeDocuments; }
}

interface HomeHistory {
  documents: Record<string, HomeDocuments>;
  load: (vaultId: string) => void;
  recordOpen: (vaultId: string, path: string, openedAt?: number) => void;
  togglePin: (vaultId: string, path: string, exists: (path: string) => boolean) => boolean;
  remap: (vaultId: string, oldPath: string, newPath: string) => void;
  remove: (vaultId: string, path: string) => void;
}

export const useHomeHistory = create<HomeHistory>((set, get) => {
  const update = (id: string, change: (value: HomeDocuments) => HomeDocuments) => {
    const key = storageKey(id);
    const previous = get().documents[key] ?? read(key);
    const next = change(previous);
    if (next === previous) return;
    set(state => ({ documents: { ...state.documents, [key]: next } }));
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* The lists are still available in this session. */ }
  };

  return {
    documents: {},
    load: id => {
      const key = storageKey(id);
      if (!get().documents[key]) set(state => ({ documents: { ...state.documents, [key]: read(key) } }));
    },
    recordOpen: (id, path, openedAt = Date.now()) => update(id, value => ({
      ...value, recent: [{ path, openedAt }, ...value.recent.filter(entry => entry.path !== path)].slice(0, historyLimit),
    })),
    togglePin: (id, path, exists) => {
      let changed = false;
      update(id, value => {
        const pinned = value.pinned.filter(exists);
        const alreadyPinned = pinned.includes(path);
        if (!alreadyPinned && pinned.length >= homePinLimit) return value;
        changed = true;
        return { ...value, pinned: alreadyPinned ? pinned.filter(item => item !== path) : [...pinned, path] };
      });
      return changed;
    },
    remap: (id, oldPath, newPath) => update(id, value => {
      const mapPath = (path: string) => isPathInside(path, oldPath) ? newPath + path.slice(oldPath.length) : path;
      const seen = new Set<string>();
      const recent = value.recent.flatMap(entry => {
        const path = mapPath(entry.path);
        if (seen.has(path)) return [];
        seen.add(path);
        return [{ ...entry, path }];
      });
      return {
        pinned: [...new Set(value.pinned.map(mapPath))],
        recent,
      };
    }),
    remove: (id, path) => update(id, value => ({
      pinned: value.pinned.filter(item => !isPathInside(item, path)),
      recent: value.recent.filter(entry => !isPathInside(entry.path, path)),
    })),
  };
});

export function selectHomeDocuments(state: HomeHistory, vaultId: string) {
  return state.documents[storageKey(vaultId)] ?? emptyHomeDocuments;
}

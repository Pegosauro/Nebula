import { create } from "zustand";

interface LinkedTaskDraft { vaultId: string; path: string; title: string }

export const useTaskNavigation = create<{
  draft: LinkedTaskDraft | null;
  setDraft: (draft: LinkedTaskDraft | null) => void;
}>(set => ({ draft: null, setDraft: draft => set({ draft }) }));

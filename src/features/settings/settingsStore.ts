import { normalizeEditorMode, type EditorMode } from "../editor/editorMode";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeChoice = "system" | "light" | "dark";
export type UiDensity = "comfortable" | "compact";

const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

interface SettingsState {
  navigationExpanded: boolean;
  setNavigationExpanded: (expanded: boolean) => void;
  showNotePropertiesByDefault: boolean;
  setShowNotePropertiesByDefault: (value: boolean) => void;
  showMarkdownAtCursor: boolean;
  setShowMarkdownAtCursor: (value: boolean) => void;
  editorFontSize: number;
  editorPageWidth: number;
  editorFullWidth: boolean;
  setEditorFontSize: (value: number) => void;
  setEditorPageWidth: (value: number) => void;
  setEditorFullWidth: (value: boolean) => void;
  schemaVersion: 1;
  editorDefaultMode: EditorMode;
  setEditorDefaultMode: (mode: EditorMode) => void;
  theme: ThemeChoice;
  density: UiDensity;
  showSidebarByDefault: boolean;
  showContextPanelByDefault: boolean;
  setTheme: (theme: ThemeChoice) => void;
  setDensity: (density: UiDensity) => void;
  setShowSidebarByDefault: (visible: boolean) => void;
  setShowContextPanelByDefault: (visible: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      navigationExpanded: false,
      setNavigationExpanded: navigationExpanded => set({ navigationExpanded }),
      showNotePropertiesByDefault: false,
      setShowNotePropertiesByDefault: showNotePropertiesByDefault => set({ showNotePropertiesByDefault }),
      showMarkdownAtCursor: true,
      setShowMarkdownAtCursor: showMarkdownAtCursor => set({ showMarkdownAtCursor }),
      editorFontSize: 17, editorPageWidth: 780, editorFullWidth: false,
      setEditorFontSize: value => set({ editorFontSize: bounded(value, 17, 14, 24) }),
      setEditorPageWidth: value => set({ editorPageWidth: bounded(value, 780, 560, 1200) }),
      setEditorFullWidth: editorFullWidth => set({ editorFullWidth }),
      schemaVersion: 1,
      editorDefaultMode: "edit",
      setEditorDefaultMode: (editorDefaultMode) => set({ editorDefaultMode }),
      theme: "system",
      density: "comfortable",
      showSidebarByDefault: true,
      showContextPanelByDefault: true,
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setShowSidebarByDefault: (showSidebarByDefault) => set({ showSidebarByDefault }),
      setShowContextPanelByDefault: (showContextPanelByDefault) => set({ showContextPanelByDefault }),
    }),
    {
      name: "nebula.settings.v1",
      merge: (persisted, current) => {
        const stored = persisted as Partial<SettingsState> | undefined;
        return { ...current, ...stored, showMarkdownAtCursor: stored?.showMarkdownAtCursor !== false, navigationExpanded: stored?.navigationExpanded === true, showNotePropertiesByDefault: stored?.showNotePropertiesByDefault === true, editorDefaultMode: normalizeEditorMode(stored?.editorDefaultMode), editorFontSize: bounded(stored?.editorFontSize, 17, 14, 24), editorPageWidth: bounded(stored?.editorPageWidth, 780, 560, 1200), editorFullWidth: stored?.editorFullWidth === true };
      },
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        showMarkdownAtCursor: state.showMarkdownAtCursor,
        navigationExpanded: state.navigationExpanded,
        showNotePropertiesByDefault: state.showNotePropertiesByDefault,
        editorFontSize: state.editorFontSize, editorPageWidth: state.editorPageWidth, editorFullWidth: state.editorFullWidth,
        editorDefaultMode: state.editorDefaultMode,
        theme: state.theme,
        density: state.density,
        showSidebarByDefault: state.showSidebarByDefault,
        showContextPanelByDefault: state.showContextPanelByDefault,
      }),
    },
  ),
);

function resolveTheme(theme: ThemeChoice): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.dataset.themeChoice = theme;
  document.documentElement.dataset.theme = resolveTheme(theme);
}

export function applyDensity(density: UiDensity): void {
  document.documentElement.dataset.density = density;
}

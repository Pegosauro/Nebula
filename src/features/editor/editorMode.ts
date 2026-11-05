export type EditorMode = "edit" | "source";
export function normalizeEditorMode(mode: unknown): EditorMode { return mode === "source" ? "source" : "edit"; }
export function initialEditorMode(_content: string, _newlyCreated = false): EditorMode { return "edit"; }

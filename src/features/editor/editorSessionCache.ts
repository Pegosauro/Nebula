import type { EditorState } from "@codemirror/state";
import type { EditorMode } from "./editorMode";

export interface EditorMemory {
  state?: EditorState;
  scrollTop?: number;
  previewScroll?: number;
  mode?: EditorMode;
  locked?: boolean;
  propertiesVisible?: boolean;
}
const memories = new Map<string, EditorMemory>();
let generation = 0;
export const editorCacheGeneration = () => generation;
export const getEditorMemory = (path: string) => memories.get(path);
export function rememberEditor(path: string, memory: EditorMemory, epoch = generation) {
  if (epoch !== generation) return;
  memories.set(path, { ...memories.get(path), ...memory });
}
export function clearEditorMemories() { generation += 1; memories.clear(); }
export function removeEditorMemories(path: string) {
  for (const key of memories.keys()) if (key === path || key.startsWith(`${path}/`)) memories.delete(key);
}
export function remapEditorMemories(from: string, to: string) {
  for (const [key, memory] of [...memories]) if (key === from || key.startsWith(`${from}/`)) {
    memories.delete(key); memories.set(`${to}${key.slice(from.length)}`, memory);
  }
}

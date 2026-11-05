let editor: Promise<typeof import("./MarkdownEditorView")> | undefined;
export function loadMarkdownEditor() {
  return editor ??= import("./MarkdownEditorView").catch(error => { editor = undefined; throw error; });
}

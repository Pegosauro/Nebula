import { EditorSelection, findClusterBreak, type ChangeSpec } from "@codemirror/state";
import { type DecorationSet, type EditorView } from "@codemirror/view";

type Span = { from: number; to: number };
const merge = (spans: Span[]) => {
  const result: Span[] = [];
  for (const span of spans.sort((a, b) => a.from - b.from)) {
    const previous = result.at(-1);
    if (previous && previous.to >= span.from) previous.to = Math.max(previous.to, span.to);
    else result.push({ ...span });
  }
  return result;
};

/** Delete visible characters while keeping concealed Markdown delimiters intact. */
export function deleteAroundHiddenSyntax(view: EditorView, syntax: DecorationSet, forward: boolean, word = false): boolean {
  if (view.state.readOnly || view.composing || !syntax.size) return false;
  const hidden: Span[] = [], owners: Span[] = [];
  for (const cursor = syntax.iter(); cursor.value; cursor.next()) {
    hidden.push({ from: cursor.from, to: cursor.to });
    const owner = cursor.value.spec.nebulaOwner as Span | undefined;
    if (owner) owners.push(owner);
  }
  const masks = merge(hidden);
  let touched = false;
  const transaction = view.state.changeByRange(range => {
    // A deliberate selection of the entire source still clears the document.
    if (range.from === 0 && range.to === view.state.doc.length && !range.empty) return { changes: { from: 0, to: range.to }, range: EditorSelection.cursor(0) };
    let from = range.from, to = range.to, at = range.head;
    if (range.empty) {
      for (;;) {
        const span = masks.find(item => forward ? item.from <= at && at < item.to : item.from < at && at <= item.to);
        if (!span) break;
        touched = true; at = forward ? span.to : span.from;
      }
      let end: number;
      if (word) end = view.moveByGroup(EditorSelection.cursor(at), forward).head;
      else {
        const line = view.state.doc.lineAt(at);
        end = line.from + findClusterBreak(line.text, at - line.from, forward, forward);
        if (end === at && (forward ? at < view.state.doc.length : at > 0)) end += forward ? 1 : -1;
      }
      from = Math.min(at, end); to = Math.max(at, end);
    }
    const deletions: Span[] = [];
    let cursor = from;
    for (const span of masks) {
      if (span.to <= from || span.from >= to) continue;
      touched = true;
      if (span.from > cursor) deletions.push({ from: cursor, to: span.from });
      cursor = Math.max(cursor, span.to);
    }
    if (cursor < to) deletions.push({ from: cursor, to });
    // Once all visible contents of a formatted span are removed, remove its
    // empty wrapper too; never leave raw **** or an empty link behind.
    const covered = merge([...masks, ...deletions]);
    for (const owner of owners) {
      if (owner.to <= from || owner.from >= to) continue;
      if (covered.some(span => span.from <= owner.from && span.to >= owner.to)) { touched = true; deletions.push(owner); }
    }
    const changes: ChangeSpec[] = merge(deletions);
    const origin = range.empty ? Math.min(at, from) : from;
    return { changes, range: EditorSelection.cursor(view.state.changes(changes).mapPos(origin, -1)) };
  });
  if (!touched) return false;
  view.dispatch({ ...transaction, scrollIntoView: true, userEvent: forward ? "delete.forward" : "delete.backward" });
  return true;
}

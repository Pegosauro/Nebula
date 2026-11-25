import { invertedEffects, isolateHistory } from "@codemirror/commands";
import { StateEffect, StateField, type Transaction } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { anchorTextComment, maxCommentLength, resolveTextComments, validCommentRange, type TextComment } from "../../domain/textComments";
import { frontmatterRange } from "../../domain/noteProperties";
import { documentText } from "./markdownAnalysis";

export const setTextComments = StateEffect.define<readonly TextComment[]>();
export const textComments = StateField.define<readonly TextComment[]>({
  create: () => [],
  update(previous, transaction) {
    const explicit = transaction.effects.filter(effect => effect.is(setTextComments)).at(-1);
    if (explicit) return transaction.isUserEvent("undo") || transaction.isUserEvent("redo")
      ? resolveTextComments(documentText(transaction.newDoc), explicit.value) : explicit.value;
    if (!transaction.docChanged || !previous.some(comment => comment.from !== null)) return previous;
    const body = documentText(transaction.newDoc);
    const next = previous.map(comment => remap(comment, transaction, body));
    return next.every((comment, i) => comment === previous[i]) ? previous : next;
  },
  provide: field => EditorView.decorations.from(field, comments => Decoration.set(comments.flatMap(comment =>
    comment.from === null ? [] : [Decoration.mark({ class: "text-comment-anchor", attributes: { "data-text-comment": comment.id } })
      .range(comment.from, comment.from + comment.quote.length)]), true)),
});

function remap(comment: TextComment, transaction: Transaction, body: string): TextComment {
  if (comment.from === null) return comment;
  const end = comment.from + comment.quote.length;
  const from = transaction.changes.mapPos(comment.from, 1), to = transaction.changes.mapPos(end, -1);
  if (validCommentRange(body, from, to)) {
    const anchor = anchorTextComment(body, from, to);
    if (from === comment.from && anchor.quote === comment.quote && anchor.before === comment.before && anchor.after === comment.after) return comment;
    return { ...comment, ...anchor };
  }
  // Formatting commands may wrap the selected text in a single replacement.
  // Keep the anchor only when its exact text occurs once in that replacement.
  const start = transaction.changes.mapPos(comment.from, -1), stop = transaction.changes.mapPos(end, 1);
  const replacement = body.slice(start, stop);
  const match = replacement.indexOf(comment.quote);
  if (match >= 0 && replacement.indexOf(comment.quote, match + 1) < 0) {
    const position = start + match;
    return { ...comment, ...anchorTextComment(body, position, position + comment.quote.length) };
  }
  return { ...comment, from: null };
}

export const textCommentHistory = invertedEffects.of(transaction => {
  const before = transaction.startState.field(textComments);
  if (transaction.effects.some(effect => effect.is(setTextComments))
    || transaction.docChanged && before.some(comment => comment.from !== null) && transaction.state.field(textComments) !== before) return [setTextComments.of(before)];
  return [];
});

export function editTextComment(view: EditorView, id: string | undefined, value: string | null, selection?: { from: number; to: number; text: string }): boolean {
  if (view.state.readOnly) return false;
  const comments = view.state.field(textComments), existing = comments.find(comment => comment.id === id);
  if (id && !existing) return false;
  const text = value?.trim();
  if (value !== null && (!text || text.length > maxCommentLength)) return false;
  const body = documentText(view.state.doc);
  let anchor: ReturnType<typeof anchorTextComment> | undefined;
  if (selection) {
    const { from, to } = selection;
    if (!validCommentRange(body, from, to) || from < (frontmatterRange(body)?.end ?? 0)
      || body.slice(from, to) !== selection.text || comments.some(comment => comment.id !== id && comment.from !== null
        && from < comment.from + comment.quote.length && to > comment.from)) return false;
    anchor = anchorTextComment(body, from, to);
  }
  let next: readonly TextComment[];
  if (existing) {
    next = text ? comments.map(comment => comment === existing ? { ...existing, ...anchor, text } : comment)
      : comments.filter(comment => comment !== existing);
  } else {
    if (!anchor || !text) return false;
    next = [...comments, { id: crypto.randomUUID(), ...anchor, text }];
  }
  view.dispatch({
    effects: setTextComments.of(next),
    annotations: isolateHistory.of("full"),
    ...(selection ? { selection: { anchor: selection.to } } : {}),
  });
  return true;
}

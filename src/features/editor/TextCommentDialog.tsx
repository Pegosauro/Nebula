import { useState } from "react";
import { maxCommentLength, type TextComment } from "../../domain/textComments";
import { EditorDialog } from "./EditorDialog";

type Selection = { from: number; to: number; text: string };

export function TextCommentDialog({ comments, initial, selection, editable, onSave, onJump, onClose }: {
  comments: readonly TextComment[];
  initial: "list" | "new" | TextComment;
  selection?: Selection;
  editable: boolean;
  onSave: (id: string | undefined, text: string | null, selection?: Selection) => boolean;
  onJump?: (comment: TextComment) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState(initial);
  const [text, setText] = useState(typeof initial === "object" ? initial.text : "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = typeof mode === "object" ? mode : undefined;
  const newComment = mode === "new";

  function save(value: string | null, anchor?: Selection) {
    if (onSave(existing?.id, value, anchor)) onClose();
    else setError("Seleziona un passaggio di testo libero da altri commenti e riprova.");
  }

  return <EditorDialog title={mode === "list" ? "Commenti della nota" : newComment ? "Aggiungi commento" : "Modifica commento"} onClose={onClose}>
    {mode === "list" ? <ul className="text-comment-list">
      {comments.map(comment => <li key={comment.id}>
        <blockquote>{comment.quote}</blockquote>
        <p>{comment.text}</p>
        {comment.from === null && <small>Testo da ricollegare</small>}
        <div className="text-comment-actions">
          {comment.from !== null && onJump && <button type="button" className="button button-secondary" onClick={() => onJump(comment)}>Vai al testo</button>}
          {editable && <button type="button" className="button button-secondary" onClick={() => {
            setMode(comment); setText(comment.text);
          }}>Modifica</button>}
        </div>
      </li>)}
    </ul> : <form onSubmit={event => { event.preventDefault(); save(text, newComment ? selection : undefined); }}>
      <blockquote className="text-comment-quote">{existing?.quote ?? selection?.text}</blockquote>
      <label className="editor-field">Commento<textarea autoFocus rows={4} value={text} maxLength={maxCommentLength} onChange={event => { setText(event.target.value); setError(""); }} /></label>
      {error && <p className="editor-panel-error" role="alert">{error}</p>}
      {existing?.from === null && <p className="editor-panel-hint">{selection ? "Puoi ricollegare il commento al testo selezionato." : "Seleziona il nuovo passaggio nella nota, poi riapri questo commento per ricollegarlo."}</p>}
      {confirmDelete ? <footer>
        <span>Eliminare questo commento?</span>
        <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(false)}>Annulla</button>
        <button type="button" className="button button-primary" onClick={() => save(null)}>Elimina</button>
      </footer> : <footer>
        {existing && <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(true)}>Elimina</button>}
        {existing?.from === null && selection && <button type="button" className="button button-secondary" disabled={!editable || !text.trim()} onClick={() => save(text, selection)}>Ricollega alla selezione</button>}
        <button type="submit" className="button button-primary" disabled={!editable || !text.trim()}>{newComment ? "Aggiungi" : "Salva"}</button>
      </footer>}
    </form>}
  </EditorDialog>;
}

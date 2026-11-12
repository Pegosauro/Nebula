import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { normSigla, objectIssues, type CharacteristicKind, type ObjectDraft, type Tree, type TreeNode, type TreeObject } from "./model";
import { objectLeafText, objectPresentation } from "./objectIcons";
import { characteristicCatalog } from "./characteristicCatalog";

export type ObjectListKind = "table" | "own" | "acquired";

interface InlineObjectsProps {
  tree: Tree;
  node: TreeNode;
  editingId?: string;
  focusList?: ObjectListKind;
  focusToken?: number;
  onSave: (draft: ObjectDraft) => string | undefined;
  onRemove: (object: TreeObject) => void;
}

export function InlineObjects({ tree, node, editingId, focusList, focusToken, onSave, onRemove }: InlineObjectsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const catalog = useMemo(() => characteristicCatalog(tree.nodes), [tree.nodes]);
  useEffect(() => { if (editingId) setEditing(editingId); }, [editingId, focusToken]);
  const tables = node.objects.flatMap(object => object.type === "externalTable" ? [object] : []);
  const own = node.objects.flatMap(object => object.type === "characteristic" && object.kind === "own" ? [object] : []);
  const acquired = node.objects.flatMap(object => object.type === "characteristic" && object.kind === "acquired" ? [object] : []);
  return (
    <section aria-label="Oggetti del nodo">
      <h3>Tabelle esterne</h3>
      <ul className="tree-object-list">
        {tables.map(object => (
          <TableRow key={object.id} object={object} node={node} editing={editing === object.id} onEdit={() => setEditing(object.id)} onClose={() => setEditing(null)} onSave={onSave} onRemove={onRemove} />
        ))}
        <li>
          <NewTableRow node={node} onSave={onSave} focusToken={focusList === "table" ? focusToken : undefined} />
        </li>
      </ul>
      <h3>Caratteristiche proprie</h3>
      <CharacteristicList catalog={catalog} node={node} kind="own" objects={own} editing={editing} onEdit={setEditing} onSave={onSave} onRemove={onRemove} focusToken={focusList === "own" ? focusToken : undefined} />
      <h3>Caratteristiche acquisite</h3>
      <CharacteristicList catalog={catalog} node={node} kind="acquired" objects={acquired} editing={editing} onEdit={setEditing} onSave={onSave} onRemove={onRemove} focusToken={focusList === "acquired" ? focusToken : undefined} />
    </section>
  );
}

function rowKeys(commit: () => void, cancel: () => void) {
  return (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };
}

function FieldError({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <span role="alert" className="tree-inline-error">{errors[0]}</span>;
}

function RemoveButton({ object, onRemove }: { object: TreeObject; onRemove: (object: TreeObject) => void }) {
  return <button type="button" className="tree-danger-text" aria-label={`Rimuovi ${objectLeafText(object)}`} onClick={() => onRemove(object)}><Trash2 size={14} /></button>;
}

function NewTableRow({ node, onSave, focusToken }: { node: TreeNode; onSave: (draft: ObjectDraft) => string | undefined; focusToken?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { if (focusToken) ref.current?.focus(); }, [focusToken]);
  const commit = () => {
    if (!name.trim()) { setErrors([]); return; }
    const draft: ObjectDraft = { type: "externalTable", tableName: name };
    const issues = objectIssues(node, draft);
    if (issues.length) { setErrors(issues); return; }
    const failure = onSave(draft);
    if (failure) { setErrors([failure]); return; }
    setName("");
    setErrors([]);
    ref.current?.focus();
  };
  const cancel = () => { setName(""); setErrors([]); };
  return (
    <div className="tree-inline-fields">
      <input ref={ref} aria-label="Nuova tabella" placeholder="Nuova tabella" value={name} onChange={event => { setName(event.target.value); setErrors([]); }} onKeyDown={rowKeys(commit, cancel)} />
      <FieldError errors={errors} />
    </div>
  );
}

function TableRow({ object, node, editing, onEdit, onClose, onSave, onRemove }: { object: Extract<TreeObject, { type: "externalTable" }>; node: TreeNode; editing: boolean; onEdit: () => void; onClose: () => void; onSave: (draft: ObjectDraft) => string | undefined; onRemove: (object: TreeObject) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(object.tableName);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { setName(object.tableName); setErrors([]); }, [object.id, object.tableName]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const commit = () => {
    const draft: ObjectDraft = { id: object.id, type: "externalTable", tableName: name };
    const issues = objectIssues(node, draft, object.id);
    if (issues.length) { setErrors(issues); return; }
    const failure = onSave(draft);
    if (failure) { setErrors([failure]); return; }
    onClose();
  };
  const cancel = () => { setName(object.tableName); setErrors([]); onClose(); };
  const presentation = objectPresentation(object);
  const Icon = presentation.Icon;
  return (
    <li>
      {editing ? (
        <div className="tree-inline-fields">
          <Icon size={15} className={`tree-obj-icon ${presentation.className}`} aria-hidden="true" />
          <input ref={ref} aria-label={`Nome tabella ${object.tableName}`} value={name} onChange={event => { setName(event.target.value); setErrors([]); }} onKeyDown={rowKeys(commit, cancel)} />
          <FieldError errors={errors} />
        </div>
      ) : (
        <button type="button" className="tree-object-main" onClick={onEdit}>
          <Icon size={15} className={`tree-obj-icon ${presentation.className}`} aria-hidden="true" />
          <span>{object.tableName}</span>
          <small>{presentation.label}</small>
        </button>
      )}
      <RemoveButton object={object} onRemove={onRemove} />
    </li>
  );
}

type CharacteristicCatalog = ReturnType<typeof characteristicCatalog>;

function CharacteristicList({ catalog, node, kind, objects, editing, onEdit, onSave, onRemove, focusToken }: { catalog: CharacteristicCatalog; node: TreeNode; kind: CharacteristicKind; objects: TreeObject[]; editing: string | null; onEdit: (id: string | null) => void; onSave: (draft: ObjectDraft) => string | undefined; onRemove: (object: TreeObject) => void; focusToken?: number }) {
  const label = kind === "own" ? "propria" : "acquisita";
  return (
    <ul className="tree-object-list">
      {objects.map(object => object.type === "characteristic" ? (
        <li key={object.id}>
          {editing === object.id
            ? <CharacteristicFields catalog={catalog} node={node} kind={kind} objectId={object.id} initialCode={object.code} initialDescription={object.description} codeLabel={`Modifica sigla ${object.code}`} descriptionLabel={`Modifica descrizione ${object.code}`} onSave={draft => { const failure = onSave(draft); if (!failure) onEdit(null); return failure; }} onCancel={() => onEdit(null)} />
            : (
              <button type="button" className="tree-object-main" onClick={() => onEdit(object.id)}>
                <KindIcon kind={kind} />
                <span>{object.code} - {object.description}</span>
              </button>
            )}
          <RemoveButton object={object} onRemove={onRemove} />
        </li>
      ) : null)}
      <li>
        <CharacteristicFields catalog={catalog} node={node} kind={kind} initialCode="" initialDescription="" codeLabel={`Nuova sigla ${label}`} descriptionLabel={`Nuova descrizione ${label}`} placeholder onSave={onSave} onCancel={() => undefined} focusToken={focusToken} />
      </li>
    </ul>
  );
}

function KindIcon({ kind }: { kind: CharacteristicKind }) {
  const presentation = objectPresentation({ id: "", type: "characteristic", order: 0, kind, code: "", description: "" });
  const Icon = presentation.Icon;
  return <Icon size={15} className={`tree-obj-icon ${presentation.className}`} fill={presentation.filled ? "currentColor" : "none"} aria-hidden="true" />;
}

function CharacteristicFields({ catalog, node, kind, objectId, initialCode, initialDescription, codeLabel, descriptionLabel, placeholder, onSave, onCancel, focusToken }: { catalog: CharacteristicCatalog; node: TreeNode; kind: CharacteristicKind; objectId?: string; initialCode: string; initialDescription: string; codeLabel: string; descriptionLabel: string; placeholder?: boolean; onSave: (draft: ObjectDraft) => string | undefined; onCancel: () => void; focusToken?: number }) {
  const codeRef = useRef<HTMLInputElement>(null);
  const autoDescription = useRef<string | undefined>(undefined);
  const [code, setCode] = useState(initialCode);
  const [description, setDescription] = useState(initialDescription);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { setCode(initialCode); setDescription(initialDescription); setErrors([]); autoDescription.current = undefined; }, [node.id, objectId, initialCode, initialDescription]);
  useEffect(() => {
    if (focusToken || objectId) codeRef.current?.focus();
  }, [focusToken, objectId]);
  const descriptions = catalog.get(normSigla(code)) ?? [];
  const changeCode = (value: string) => {
    if (normSigla(value) !== normSigla(code)) {
      const matches = catalog.get(normSigla(value)) ?? [];
      if (matches.length === 1) {
        setDescription(matches[0]);
        autoDescription.current = matches[0];
      } else {
        if (autoDescription.current !== undefined && description === autoDescription.current) setDescription("");
        autoDescription.current = undefined;
      }
    }
    setCode(value);
    setErrors([]);
  };
  const commit = () => {
    if (!objectId && !code.trim() && !description.trim()) { setErrors([]); return; }
    const draft: ObjectDraft = { id: objectId, type: "characteristic", kind, code, description };
    const issues = objectIssues(node, draft, objectId);
    if (issues.length) { setErrors(issues); return; }
    const failure = onSave(draft);
    if (failure) { setErrors([failure]); return; }
    if (!objectId) {
      setCode("");
      setDescription("");
      autoDescription.current = undefined;
      setErrors([]);
      codeRef.current?.focus();
    }
  };
  const cancel = () => {
    setCode(initialCode);
    setDescription(initialDescription);
    setErrors([]);
    autoDescription.current = undefined;
    onCancel();
  };
  return (
    <div className="tree-inline-fields">
      <KindIcon kind={kind} />
      <input ref={codeRef} aria-label={codeLabel} placeholder={placeholder ? "Sigla" : undefined} value={code} onChange={event => changeCode(event.target.value)} onKeyDown={rowKeys(commit, cancel)} />
      <input aria-label={descriptionLabel} placeholder={placeholder ? "Descrizione" : undefined} value={description} onChange={event => { setDescription(event.target.value); autoDescription.current = undefined; setErrors([]); }} onKeyDown={rowKeys(commit, cancel)} />
      {descriptions.length > 1 && <label className="tree-description-choices">Più descrizioni per questa sigla: scegli o scrivi la descrizione.
        <select aria-label={`Descrizioni per ${code.trim()}`} value={descriptions.includes(description) ? description : ""} onChange={event => { setDescription(event.target.value); autoDescription.current = event.target.value; setErrors([]); }}>
          <option value="" disabled>Scegli una descrizione…</option>
          {descriptions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
      <FieldError errors={errors} />
    </div>
  );
}

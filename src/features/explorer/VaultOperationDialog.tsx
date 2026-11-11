import { configTitle, isConfiguratorPath } from "../configurator/model";
import { isTreePath, treeTitle } from "../trees/model";
import { withoutFrontmatter } from "../../domain/noteProperties";
import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, FolderInput, FolderPlus, Pencil, Trash2, X } from "lucide-react";
import { basename, dirname, isPathInside, withoutMarkdownExtension } from "../../domain/path";
import type { VaultEntry, VaultSnapshot } from "../../domain/vault";
import { IconButton } from "../../components/ui/IconButton";
import { useVaultStore } from "../vault/vaultStore";
import { useDocumentStore } from "../editor/documentStore";
import { BUILTIN_TEMPLATES, instantiateTemplate, personalTemplates } from "../templates/noteTemplates";
import { vaultService } from "../vault/vaultService";
import type { QuickNoteCapture } from "../notes/quickNoteConversion";
import { quickNoteTitle } from "../notes/quickNotes";

export type VaultOperationRequest =
  | { type: "create-note"; parentPath: string; quickNote?: QuickNoteCapture; initialTemplateId?: string }
  | { type: "create-folder"; parentPath: string }
  | { type: "rename"; entry: VaultEntry }
  | { type: "move"; entry: VaultEntry }
  | { type: "delete"; entry: VaultEntry };

interface VaultOperationDialogProps {
  request: VaultOperationRequest;
  snapshot: VaultSnapshot;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

function directoryOptions(entries: VaultEntry[], depth = 0): Array<{ path: string; label: string }> {
  const result: Array<{ path: string; label: string }> = [];
  for (const entry of entries) {
    if (entry.type !== "directory") continue;
    result.push({ path: entry.path, label: `${"— ".repeat(depth)}${entry.name}` });
    result.push(...directoryOptions(entry.children ?? [], depth + 1));
  }
  return result;
}

const dialogConfig = {
  "create-note": { title: "Nuova nota", icon: FilePlus2, confirm: "Crea nota" },
  "create-folder": { title: "Nuova cartella", icon: FolderPlus, confirm: "Crea cartella" },
  rename: { title: "Rinomina", icon: Pencil, confirm: "Rinomina" },
  move: { title: "Sposta", icon: FolderInput, confirm: "Sposta" },
  delete: { title: "Elimina", icon: Trash2, confirm: "Elimina definitivamente" },
} as const;

export function VaultOperationDialog({ request, snapshot, onClose, onCompleted }: VaultOperationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createNote = useVaultStore((state) => state.createNote);
  const createFolder = useVaultStore((state) => state.createFolder);
  const renameEntry = useVaultStore((state) => state.renameEntry);
  const moveEntry = useVaultStore((state) => state.moveEntry);
  const deleteEntry = useVaultStore((state) => state.deleteEntry);
  const [value, setValue] = useState(
    request.type === "rename" && isConfiguratorPath(request.entry.path) ? configTitle(basename(request.entry.path)) : request.type === "rename" && isTreePath(request.entry.path) ? treeTitle(basename(request.entry.path)) : request.type === "rename" && request.entry.extension === ".md"
      ? withoutMarkdownExtension(basename(request.entry.path))
      : request.type === "rename" ? basename(request.entry.path) : request.type === "create-note" && request.quickNote ? quickNoteTitle(request.quickNote.text) : "",
  );
  const [targetDirectory, setTargetDirectory] = useState(
    request.type === "move" ? dirname(request.entry.path) : "parentPath" in request ? request.parentPath : "",
  );
  const [templateId, setTemplateId] = useState(request.type === "create-note" ? request.initialTemplateId ?? "" : "");
  const [templateContent, setTemplateContent] = useState<string>();
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string>();
  const personal = useMemo(() => personalTemplates(snapshot), [snapshot]);
  const selectedTemplate = [...BUILTIN_TEMPLATES, ...personal].find(template => template.id === templateId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const hasUnsavedDocuments = useDocumentStore((state) => request.type === "delete" && Object.values(state.sessions)
    .some((session) => isPathInside(session.path, request.entry.path) && session.content !== session.savedContent));
  const capture = request.type === "create-note" ? request.quickNote : undefined;
  const config = capture ? { ...dialogConfig["create-note"], title: "Trasforma appunto" } : dialogConfig[request.type];
  const Icon = config.icon;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTemplateError(undefined);
    setTemplateContent(undefined);
    if (!selectedTemplate?.path) { setTemplateLoading(false); setTemplateContent(selectedTemplate?.content); return; }
    const templatePath = selectedTemplate.path;
    setTemplateLoading(true);
    void (async () => {
      try {
        const { content } = await vaultService.readText(templatePath);
        const { preparePersonalTemplate } = await import("../templates/preparePersonalTemplate");
        if (!cancelled) setTemplateContent(preparePersonalTemplate(content, templatePath));
      } catch (caught) {
        if (!cancelled) setTemplateError(caught instanceof Error ? caught.message : "Impossibile leggere il modello.");
      } finally { if (!cancelled) setTemplateLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [templateId, selectedTemplate?.path, selectedTemplate?.content]);

  const folders = useMemo(() => {
    const all = [{ path: "", label: `Radice · ${snapshot.name}` }, ...directoryOptions(snapshot.root)];
    if (request.type !== "move" || request.entry.type !== "directory") return all;
    return all.filter((folder) => !isPathInside(folder.path, request.entry.path));
  }, [request, snapshot]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (request.type === "create-note") {
        if (templateId && (templateLoading || templateError || templateContent === undefined)) throw new Error("Attendi il caricamento del modello o scegli un altro modello.");
        const content = capture ? (await import("../notes/quickNoteConversion")).quickNoteDocument(capture, value, templateId === "procedure") : templateId ? instantiateTemplate(templateContent!, value) : undefined;
        await createNote(targetDirectory, value, true, content);
        onCompleted(capture ? "Nota creata. L’appunto originale resta nel foglio." : templateId ? "Nota creata dal modello nel Vault." : "Nota creata nel Vault.");
      } else if (request.type === "create-folder") {
        await createFolder(request.parentPath, value);
        onCompleted("Cartella creata nel Vault.");
      } else if (request.type === "rename") {
        await renameEntry(request.entry, value);
        onCompleted("Elemento rinominato in sicurezza.");
      } else if (request.type === "move") {
        await moveEntry(request.entry, targetDirectory);
        onCompleted("Elemento spostato nel Vault.");
      } else {
        await deleteEntry(request.entry);
        onCompleted("Elemento eliminato dal Vault.");
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  const entry = "entry" in request ? request.entry : undefined;
  const parentPath = "parentPath" in request ? request.parentPath : undefined;
  const displayEntryName = entry?.extension === ".md" ? withoutMarkdownExtension(entry.name) : entry?.name;
  const displayLocation = entry?.extension === ".md" ? withoutMarkdownExtension(entry.path) : entry?.path || parentPath || snapshot.name;

  return (
    <dialog
      ref={dialogRef}
      className="vault-dialog"
      aria-labelledby="vault-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <header className="vault-dialog-header">
          <span className={`vault-dialog-icon ${request.type === "delete" ? "is-danger" : ""}`}><Icon size={19} /></span>
          <div><h2 id="vault-dialog-title">{config.title}</h2><span>{displayLocation}</span></div>
          <IconButton label="Chiudi" disabled={busy} onClick={onClose}><X size={17} /></IconButton>
        </header>

        <div className="vault-dialog-body">
          {request.type === "create-note" ? <>
            <label className="field-label">Modello
              <select value={templateId} disabled={busy} onChange={event => setTemplateId(event.target.value)}>
                <option value="">Nota libera</option>
                <optgroup label="Modelli iniziali">{BUILTIN_TEMPLATES.filter(template => !capture || template.id === "procedure").map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</optgroup>
                {!capture && personal.length > 0 ? <optgroup label="Modelli personali">{personal.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</optgroup> : null}
              </select>
              <span>{capture ? templateId === "procedure" ? "Il modello tecnico da compilare, con il testo dell’appunto in fondo." : "Il testo dell’appunto in una nota autonoma." : selectedTemplate?.description ?? "Una pagina vuota con il titolo della nota."}</span>
            </label>
            {capture ? <><p className="template-hint">Appunto del {capture.timestamp}. L’originale resta nel foglio.</p><details className="template-preview"><summary>Testo dell’appunto</summary><pre>{capture.text}</pre></details></> : !personal.length ? <p className="template-hint">Per aggiungere un modello personale, apri una nota e scegli “Salva come modello”.</p> : null}
            {templateLoading ? <p className="template-hint" role="status">Caricamento modello…</p> : null}
            {templateContent !== undefined && templateId ? <details className="template-preview"><summary>Anteprima del modello</summary><pre>{withoutFrontmatter(templateContent).replaceAll("{{titolo}}", value.trim() || "Titolo della nota").replaceAll("{{data}}", new Date().toLocaleDateString("it-IT"))}</pre></details> : null}
            {templateError ? <p className="dialog-error" role="alert">{templateError}</p> : null}
          </> : null}
          {request.type === "delete" ? (
            <div className="delete-warning" role="alert">
              <strong>Eliminare “{displayEntryName}”?</strong>
              <p>{entry?.type === "directory" ? "La cartella e tutto il suo contenuto verranno rimossi." : "Il file verrà rimosso dal disco."} Questa operazione non può essere annullata da Nebula.</p>
              {hasUnsavedDocuments ? <p><strong>Attenzione:</strong> sono presenti modifiche non salvate che verranno perse.</p> : null}
            </div>
          ) : request.type === "move" ? (
            <label className="field-label">
              Cartella di destinazione
              <select value={targetDirectory} disabled={busy} onChange={(event) => setTargetDirectory(event.target.value)}>
                {folders.map((folder) => <option key={folder.path || "vault-root"} value={folder.path}>{folder.label}</option>)}
              </select>
            </label>
          ) : (
            <label className="field-label">
              {request.type === "create-note" ? "Nome della nota" : request.type === "create-folder" ? "Nome della cartella" : "Nuovo nome"}
              <input
                autoFocus
                value={value}
                disabled={busy}
                placeholder={request.type === "create-note" ? "Nuova nota" : "Nome"}
                onChange={(event) => setValue(event.target.value)}
              />
              {request.type === "create-note" ? <span>L’estensione del file viene aggiunta automaticamente.</span> : null}
            </label>
          )}
          {request.type === "create-note" ? <label className="field-label">Cartella di destinazione
            <select value={targetDirectory} disabled={busy} onChange={event => setTargetDirectory(event.target.value)}>
              {folders.map(folder => <option key={folder.path || "vault-root"} value={folder.path}>{folder.label}</option>)}
            </select>
          </label> : null}
          {error ? <p className="dialog-error" role="alert">{error}</p> : null}
        </div>

        <footer className="vault-dialog-footer">
          <button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>Annulla</button>
          <button
            className={`button ${request.type === "delete" ? "button-danger" : "button-primary"}`}
            type="submit"
            disabled={busy || (request.type === "create-note" && Boolean(templateId) && (templateLoading || Boolean(templateError) || templateContent === undefined)) || ((request.type === "create-note" || request.type === "create-folder" || request.type === "rename") && !value.trim())}
          >
            {busy ? "Operazione in corso…" : config.confirm}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

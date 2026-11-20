import { useEffect, useId, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeftRight, HardDriveDownload, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { canPreviewBackupFile, type VaultBackupChange, type VaultBackupChoice, type VaultBackupFilePreview, type VaultBackupReview } from "../../infrastructure/filesystem/vaultBackup";
import { vaultService } from "./vaultService";
import { useVaultStore } from "./vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";

export function VaultBackupSettings() {
  const { backup, backupBusy, backupError, status } = useVaultStore(useShallow(state => ({
    backup: state.backup, backupBusy: state.backupBusy, backupError: state.backupError, status: state.status,
  })));
  const { configureBackup, disableBackup, syncBackup, reviewBackup } = useVaultStore.getState();
  const linked = status === "ready";
  return (
    <section className="settings-section vault-backup-settings">
      <div className="settings-section-title">
        <HardDriveDownload size={19} />
        <div><h2>Backup del Vault</h2><p>Una copia locale con cui continuare a lavorare se il Vault principale è indisponibile.</p></div>
      </div>
      <div className="setting-row">
        <div>
          <strong>{backup?.name ?? "Backup disattivato"}</strong>
          <span>{backup
            ? backup.usingBackup ? "Stai lavorando nella cartella di backup." : backup.pending
              ? "Ci sono modifiche da confrontare." : `Ultimo aggiornamento ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(backup.syncedAt)}`
            : linked ? "Scegli una cartella vuota e separata dal Vault." : "Apri un Vault per configurare la sua copia."}</span>
        </div>
        <div className="vault-backup-actions">
          {!backup ? <button className="button button-secondary" type="button" disabled={!linked || backupBusy} onClick={() => void configureBackup()}>Configura backup</button>
            : backup.pending ? <>
              <button className="button button-secondary" type="button" disabled={backupBusy} onClick={() => void syncBackup()}>Autorizza backup</button>
              <button className="button button-secondary" type="button" disabled={!linked || backupBusy} onClick={() => void reviewBackup()}>Confronta modifiche</button>
            </> : <>
              <button className="button button-secondary" type="button" disabled={!linked || backupBusy} onClick={() => void syncBackup()}>Aggiorna ora</button>
              <button className="button button-secondary" type="button" disabled={!linked || backupBusy} onClick={() => void disableBackup()}>Scollega backup</button>
            </>}
        </div>
      </div>
      {backupBusy && <p className="config-hint" role="status">Operazione sul backup in corso…</p>}
      {(backupError || backup?.error) && <p className="config-error" role="alert">{backupError || backup?.error}</p>}
    </section>
  );
}

export function VaultBackupBanner() {
  const backup = useVaultStore(state => state.backup);
  const busy = useVaultStore(state => state.backupBusy);
  const error = useVaultStore(state => state.backupError);
  const status = useVaultStore(state => state.status);
  const inSettings = useWorkspaceStore(state => state.activity === "settings");
  if (!backup?.pending || status !== "ready") return null;
  return <div className="vault-backup-banner">
    <HardDriveDownload size={17} aria-hidden="true" />
    <div>
      <strong>{backup.usingBackup ? "Modalità backup" : "Backup da riconciliare"}</strong>
      <span>{backup.usingBackup ? "Le modifiche vengono salvate nella cartella di backup." : "Il backup contiene modifiche da confrontare con il Vault principale."}</span>
      {error && !inSettings && <span className="vault-backup-notice-error" role="alert">{error}</span>}
    </div>
    {!inSettings && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void useVaultStore.getState().reviewBackup()}>
      {busy ? "Verifica in corso…" : "Confronta modifiche"}
    </button>}
  </div>;
}

function changeLabel(change: VaultBackupChange) {
  if (change.primaryChanged && change.backupChanged) return "Conflitto tra versioni";
  const side = change.backupChanged ? "nel backup" : "nel principale";
  const version = change.backupChanged ? change.backup : change.primary;
  const other = change.backupChanged ? change.primary : change.backup;
  if (!version) return `Eliminato ${side}`;
  if (!other) return `Aggiunto ${side}`;
  return `Modificato ${side}`;
}

function BackupFilePreview({ path }: { path: string }) {
  const [versions, setVersions] = useState<(VaultBackupFilePreview | null)[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  return <details className="backup-file-preview" onToggle={event => {
    if (!event.currentTarget.open || versions || loading || error) return;
    setLoading(true);
    void vaultService.previewBackupFile(path).then(setVersions).catch(error => setError(readableFileSystemError(error))).finally(() => setLoading(false));
  }}>
    <summary>Vedi versioni</summary>
    {loading && <span role="status">Caricamento…</span>}
    {error && <span role="alert">{error}</span>}
    {versions && <div className="backup-file-versions">
      {versions.map((version, index) => <div key={index}>
        <strong>{index === 0 ? "Vault principale" : "Backup"}</strong>
        <pre tabIndex={0}>{version ? version.text || "File vuoto" : "File assente"}</pre>
        {version?.truncated && <small>Mostrata solo la parte iniziale del file.</small>}
      </div>)}
    </div>}
  </details>;
}

export function VaultBackupReviewDialog() {
  const review = useVaultStore(state => state.backupReview);
  return review ? <BackupReview key={review.revision} review={review} /> : null;
}

function BackupReview({ review }: { review: VaultBackupReview }) {
  const { backupBusy, backupError } = useVaultStore(useShallow(state => ({ backupBusy: state.backupBusy, backupError: state.backupError })));
  const { dismissBackupReview, reviewBackup, applyBackup } = useVaultStore.getState();
  const [choices, setChoices] = useState(() => new Map(review.changes.flatMap(change =>
    change.primaryChanged === change.backupChanged ? [] : [[change.path, change.backupChanged ? "backup" : "primary"] as const])));
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="vault-dialog vault-backup-dialog" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault();
    dismissBackupReview();
  }}>
    <form onSubmit={event => { event.preventDefault(); void applyBackup(choices); }}>
      <header className="vault-dialog-header">
        <span className="vault-dialog-icon"><ArrowLeftRight size={19} /></span>
        <div><h2 id={titleId}>Confronta Vault principale e backup</h2><span>{review.changes.length} {review.changes.length === 1 ? "differenza" : "differenze"}</span></div>
        <IconButton label="Chiudi confronto" disabled={backupBusy} onClick={dismissBackupReview}><X size={17} /></IconButton>
      </header>
      <div className="vault-dialog-body">
        {review.changes.length ? <>
          <p>Decidi quale versione conservare. Le versioni sostituite nel Vault principale vengono archiviate nella cartella di backup.</p>
          <ul className="backup-review-list">
            {review.changes.map(change => {
              const conflict = change.primaryChanged && change.backupChanged;
              const options = (change.primary === "file" || change.backup === "file") && change.primary !== "directory" && change.backup !== "directory";
              return <li key={change.path}>
                <div className="backup-review-row">
                  <div><strong>{change.path}</strong><span className={conflict ? "is-conflict" : undefined}>{changeLabel(change)}</span></div>
                  <select aria-label={`Versione da tenere per ${change.path}`} value={choices.get(change.path) ?? ""} disabled={backupBusy}
                    onChange={event => {
                      const value = event.target.value as VaultBackupChoice | "";
                      setChoices(previous => { const next = new Map(previous); if (value) next.set(change.path, value); else next.delete(change.path); return next; });
                    }}>
                    {conflict && <option value="">Scegli una versione</option>}
                    <option value="primary">{change.primary ? "Mantieni principale" : "Mantieni eliminazione nel principale"}</option>
                    <option value="backup">{change.backup ? "Usa versione del backup" : "Applica eliminazione del backup"}</option>
                  </select>
                </div>
                {options && canPreviewBackupFile(change.path) && <BackupFilePreview path={change.path} />}
              </li>;
            })}
          </ul>
        </> : <p>Le due cartelle sono allineate. Puoi tornare al Vault principale.</p>}
        {backupError && <p className="config-error" role="alert">{backupError}</p>}
      </div>
      <footer className="vault-dialog-footer">
        {backupError && <button type="button" className="button button-secondary" disabled={backupBusy} onClick={() => void reviewBackup()}>Aggiorna confronto</button>}
        <button type="button" className="button button-secondary" disabled={backupBusy} onClick={dismissBackupReview}>Annulla</button>
        <button type="submit" className="button button-primary" disabled={backupBusy || choices.size !== review.changes.length}>
          {backupBusy ? "Operazione in corso…" : review.changes.length ? "Applica e apri il Vault principale" : "Apri il Vault principale"}
        </button>
      </footer>
    </form>
  </dialog>;
}

import { FolderOpen, HardDrive, LoaderCircle, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { NebulaMark } from "../../components/brand/NebulaMark";
import { useVaultStore } from "./vaultStore";
import { RecentVaultList } from "./RecentVaultList";

export function WelcomeView() {
  const status = useVaultStore((state) => state.status);
  const error = useVaultStore((state) => state.error);
  const savedVaultName = useVaultStore((state) => state.savedVaultName);
  const chooseVault = useVaultStore((state) => state.chooseVault);
  const reconnect = useVaultStore((state) => state.reconnect);
  const backup = useVaultStore(state => state.backup);
  const backupBusy = useVaultStore(state => state.backupBusy);
  const backupError = useVaultStore(state => state.backupError);
  const openBackup = useVaultStore(state => state.openBackup);

  const loading = status === "opening" || status === "restoring" || status === "scanning";
  const needsPermission = status === "needs-permission";
  const unsupported = status === "unsupported";
  const primaryLabel = needsPermission ? `Riconnetti ${savedVaultName ?? "Vault"}` : "Apri Vault";
  const primaryAction = needsPermission ? reconnect : chooseVault;

  return (
    <div className="welcome-view">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <NebulaMark className="welcome-mark" />
        <h1 id="welcome-title">Nebula</h1>
        <p className="welcome-lead">Le tue note. I tuoi file. Il tuo spazio.</p>

        {unsupported ? (
          <div className="capability-error" role="alert">
            <TriangleAlert size={19} />
            <div>
              <strong>Accesso cartelle non disponibile</strong>
              <span>Usa Edge o Chrome desktop per collegare direttamente un Vault locale.</span>
            </div>
          </div>
        ) : (
          <button className="button button-primary welcome-action" type="button" disabled={loading || backupBusy} onClick={() => void primaryAction()}>
            {loading ? <LoaderCircle className="spin" size={18} /> : needsPermission ? <LockKeyhole size={18} /> : <FolderOpen size={18} />}
            {loading ? "Apertura in corso…" : primaryLabel}
          </button>
        )}

        {backup && needsPermission && <div className="welcome-backup-action">
          <button className="button button-secondary" type="button" disabled={backupBusy} onClick={() => void openBackup()}>
            <HardDrive size={16} />{backupBusy ? "Apertura del backup…" : "Apri backup"}
          </button>
          <span>{backup.name} · Ultima copia {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(backup.syncedAt)}</span>
          {backupError && <p className="inline-error" role="alert">{backupError}</p>}
        </div>}
        <button className="button button-secondary test-vault-action" disabled={loading || backupBusy} onClick={() => void useVaultStore.getState().openTestVault()}>Apri Vault di prova</button>
        <p className="config-hint">Esempi locali nel browser, separati dai tuoi file. <a href={`${import.meta.env.BASE_URL}samples/Nebula-Vault-Test.zip`} download>Scarica il Vault ZIP</a></p>
        <div className="welcome-facts">
          <div>
            <HardDrive size={18} />
            <span>Scegli una cartella locale</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>I file restano sul tuo dispositivo</span>
          </div>
        </div>

        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {!needsPermission && !loading ? <RecentVaultList /> : null}
      </section>
      <p className="compatibility-note">
        Il Vault diretto richiede un browser desktop compatibile con File System Access API.
      </p>
    </div>
  );
}

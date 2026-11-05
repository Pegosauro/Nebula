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
          <button className="button button-primary welcome-action" type="button" disabled={loading} onClick={() => void primaryAction()}>
            {loading ? <LoaderCircle className="spin" size={18} /> : needsPermission ? <LockKeyhole size={18} /> : <FolderOpen size={18} />}
            {loading ? "Apertura in corso…" : primaryLabel}
          </button>
        )}

        <button className="button button-secondary test-vault-action" disabled={loading} onClick={() => void useVaultStore.getState().openTestVault()}>Apri Vault di prova</button>
        <p className="config-hint">Esempi locali nel browser, separati dai tuoi file. <a href="/samples/Nebula-Vault-Test.zip" download>Scarica il Vault ZIP</a></p>
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

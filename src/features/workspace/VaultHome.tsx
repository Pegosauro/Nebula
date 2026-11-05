import { vaultService } from "../vault/vaultService";
import { FilePlus2, FileText, FolderTree, Link2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { VaultOperationDialog } from "../explorer/VaultOperationDialog";
import { useVaultStore } from "../vault/vaultStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";

export function VaultHome() {
  const snapshot = useVaultStore((state) => state.snapshot);
  const linkCount = useKnowledgeStore((state) => state.linkCount);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  if (!snapshot) return null;

  return (
    <div className="workspace-home">
      <section className="home-intro">
        <div className="home-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <p className="workspace-kicker">{snapshot.name}</p>
        <h1>Vault pronto</h1>
        <p>
          {vaultService.isBrowserTestVault() ? "Vault di prova: i file sono nell’archivio locale del browser. Apri Configuratori per provare la pergola dimostrativa." : "Nebula lavora direttamente nella cartella locale. Apri le note da File, trova i contenuti con Cerca e gestisci i progetti in Configuratori."}
        </p>
        <div className="home-stats" aria-label="Riepilogo Vault">
          <span><FileText size={16} /> {snapshot.stats.notes} note</span>
          <span><FolderTree size={16} /> {snapshot.stats.directories} cartelle</span>
          <span><Link2 size={16} /> {linkCount} collegamenti</span>
        </div>
        <div className="home-create"><button className="button button-primary" type="button" onClick={() => setCreating(true)}><FilePlus2 size={17} />Nuovo</button><span>Nota libera o da modello</span></div>
        {notice ? <p role="status">{notice}</p> : null}
      </section>
      <div className="foundation-path" aria-label="Funzioni disponibili">
        <span>Vault locale</span>
        <span>Editor Markdown</span>
        <span>Wikilink</span>
        <span>Ricerca</span>
        <span>Configuratori</span>
      </div>
      {creating ? <VaultOperationDialog request={{ type: "create-note", parentPath: "" }} snapshot={snapshot} onClose={() => setCreating(false)} onCompleted={setNotice} /> : null}
    </div>
  );
}

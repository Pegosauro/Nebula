import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { VaultOperationDialog } from "../explorer/VaultOperationDialog";
import { useSearchStore } from "../search/searchStore";
import { useVaultStore } from "../vault/vaultStore";
import { vaultService } from "../vault/vaultService";
import { HomeQuickNote } from "./HomeQuickNote";
import { HomeRecent } from "./HomeRecent";
import { HomeToday } from "./HomeToday";
import type { VaultSnapshot } from "../../domain/vault";
import "./home.css";

const welcomedVaults = new Set<string>();

export function VaultHome() {
  const snapshot = useVaultStore(state => state.snapshot);
  const vaultId = useVaultStore(state => state.activeVaultId);
  return snapshot && vaultId ? <Home key={vaultId} snapshot={snapshot} vaultId={vaultId} /> : null;
}

function Home({ snapshot, vaultId }: { snapshot: VaultSnapshot; vaultId: string }) {
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [enter] = useState(() => !welcomedVaults.has(vaultId));

  useEffect(() => { welcomedVaults.add(vaultId); }, [vaultId]);

  return <div className={`workspace-home${enter ? " has-entrance" : ""}`}>
    <header className="home-header">
      <div className="home-heading">
        <p>{vaultService.isBrowserTestVault() ? "Vault di prova" : snapshot.name}</p>
        <h1>Inizio</h1>
      </div>
      <div className="home-header-actions">
        <button className="button button-secondary home-search" type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+O Meta+O" onClick={() => useSearchStore.getState().openQuickSwitcher()}>
          <Search size={18} aria-hidden="true" /><span>Cerca nel Vault</span><kbd aria-hidden="true">Ctrl / ⌘ + O</kbd>
        </button>
        <button className="button button-primary home-new-note" type="button" onClick={() => { setNotice(""); setCreating(true); }}><Plus size={19} aria-hidden="true" />Nuova nota</button>
      </div>
    </header>
    {notice && <p className="home-creation-notice" role="status">{notice}</p>}
    <div className="home-grid">
      <div className="home-left">
        <HomeQuickNote vaultId={vaultId} />
        <HomeRecent vaultId={vaultId} root={snapshot.root} />
      </div>
      <HomeToday vaultId={vaultId} />
    </div>
    {creating && <VaultOperationDialog request={{ type: "create-note", parentPath: "" }} snapshot={snapshot} onClose={() => setCreating(false)} onCompleted={setNotice} />}
  </div>;
}

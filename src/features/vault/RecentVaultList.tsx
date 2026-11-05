import { Clock3, FolderOpen } from "lucide-react";
import { useVaultStore } from "./vaultStore";

interface RecentVaultListProps { compact?: boolean }

function formatOpenedAt(value: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

export function RecentVaultList({ compact = false }: RecentVaultListProps) {
  const recentVaults = useVaultStore((state) => state.recentVaults);
  const openRecent = useVaultStore((state) => state.openRecent);
  const status = useVaultStore((state) => state.status);
  const loading = status === "opening" || status === "restoring" || status === "scanning";
  if (!recentVaults.length) return null;

  return (
    <section className={`recent-vaults ${compact ? "is-compact" : ""}`} aria-labelledby={compact ? "recent-vaults-compact" : "recent-vaults-title"}>
      <div className="recent-vaults-heading"><Clock3 size={15} /><h2 id={compact ? "recent-vaults-compact" : "recent-vaults-title"}>Vault recenti</h2></div>
      <div className="recent-vault-list">
        {recentVaults.map((vault) => (
          <button key={vault.id} type="button" disabled={loading} onClick={() => void openRecent(vault.id)}>
            <span className="recent-vault-icon"><FolderOpen size={17} /></span>
            <span className="recent-vault-copy"><strong>{vault.name}</strong><small>Ultima apertura {formatOpenedAt(vault.lastOpenedAt)}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

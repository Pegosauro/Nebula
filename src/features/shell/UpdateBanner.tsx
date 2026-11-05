import { RefreshCw, X } from "lucide-react";
import { usePwaStore } from "../pwa/pwaStore";

export function UpdateBanner() {
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const setUpdateAvailable = usePwaStore((state) => state.setUpdateAvailable);
  const update = usePwaStore((state) => state.update);

  if (!updateAvailable) return null;

  return (
    <aside className="update-banner" aria-live="polite">
      <div>
        <strong>Aggiornamento disponibile</strong>
        <span>La nuova versione verrà applicata quando scegli tu.</span>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void update()}>
        <RefreshCw size={15} />
        Aggiorna
      </button>
      <button className="banner-close" type="button" aria-label="Chiudi" onClick={() => setUpdateAvailable(false)}>
        <X size={16} />
      </button>
    </aside>
  );
}

import { useQuickNoteUiStore } from "../notes/quickNoteUiStore";
import { useState } from "react";
import { QuickNoteDialog } from "../notes/QuickNoteDialog";
import { openQuickNotes } from "../notes/quickNotes";
import { useVaultStore } from "../vault/vaultStore";
import { Search, SunMoon, NotebookPen, X } from "lucide-react";
import { NebulaMark } from "../../components/brand/NebulaMark";
import { IconButton } from "../../components/ui/IconButton";
import { useSettingsStore } from "../settings/settingsStore";
import { TabBar } from "./TabBar";
import { useSearchStore } from "../search/searchStore";

export function AppHeader() {
  const ready = useVaultStore(state => state.status === "ready" && !!state.snapshot);
  const quickNote = useQuickNoteUiStore(state => state.open);
  const showQuickNote = useQuickNoteUiStore(state => state.show);
  const hideQuickNote = useQuickNoteUiStore(state => state.hide);
  const [quickSaved, setQuickSaved] = useState(false);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const openQuickSwitcher = useSearchStore((state) => state.openQuickSwitcher);

  const toggleTheme = () => {
    const actual = document.documentElement.dataset.theme;
    setTheme(actual === "dark" ? "light" : "dark");
  };

  return (
    <>
    <header className="app-header">
      <div className="brand-area">
        <NebulaMark className="brand-mark" />
        <strong>Nebula</strong>
      </div>
      <TabBar />
      <div className="header-actions">
        <IconButton label="Nota veloce" disabled={!ready} title={ready ? "Nota veloce" : "Collega un Vault per aggiungere appunti"} onClick={() => { setQuickSaved(false); showQuickNote(); }}><NotebookPen size={19} /></IconButton>
        <IconButton label="Quick Switcher (Ctrl/⌘ O)" onClick={openQuickSwitcher}>
          <Search size={18} />
        </IconButton>
        <IconButton label={`Tema: ${{ system: "Sistema", light: "Chiaro", dark: "Scuro" }[theme]}`} onClick={toggleTheme}>
          <SunMoon size={18} />
        </IconButton>
      </div>
    </header>
    {quickNote && <QuickNoteDialog onClose={() => hideQuickNote()} onSaved={() => { hideQuickNote(); setQuickSaved(true); }} />}
    {quickSaved && <div className="quick-note-toast" role="status"><span>Appunto aggiunto al foglio</span><button type="button" onClick={() => { openQuickNotes(); setQuickSaved(false); }}>Apri foglio</button><IconButton label="Chiudi messaggio" onClick={() => setQuickSaved(false)}><X size={15} /></IconButton></div>}
    </>
  );
}

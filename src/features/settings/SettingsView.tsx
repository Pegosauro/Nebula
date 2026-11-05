import { useVaultStore } from "../vault/vaultStore";
import { AppWindow, Download, Info, LayoutPanelLeft, MonitorCog, Moon, Sun } from "lucide-react";
import { usePwaStore } from "../pwa/pwaStore";
import { useSettingsStore, type ThemeChoice, type UiDensity } from "./settingsStore";

const themes: Array<{ id: ThemeChoice; label: string; icon: typeof Sun }> = [
  { id: "system", label: "Sistema", icon: MonitorCog },
  { id: "light", label: "Chiaro", icon: Sun },
  { id: "dark", label: "Scuro", icon: Moon },
];

const densities: Array<{ id: UiDensity; label: string }> = [
  { id: "comfortable", label: "Comoda" },
  { id: "compact", label: "Compatta" },
];

export function SettingsView() {
  const vaultError = useVaultStore(state => state.error);
  const testVaultBusy = useVaultStore(state => state.status === "opening" || state.status === "scanning" || state.status === "restoring");
  const navigationExpanded = useSettingsStore(state => state.navigationExpanded);
  const setNavigationExpanded = useSettingsStore(state => state.setNavigationExpanded);
  const showProperties = useSettingsStore(state => state.showNotePropertiesByDefault);
  const setShowProperties = useSettingsStore(state => state.setShowNotePropertiesByDefault);
  const showMarkdownAtCursor = useSettingsStore(state => state.showMarkdownAtCursor);
  const setShowMarkdownAtCursor = useSettingsStore(state => state.setShowMarkdownAtCursor);
  const editorDefaultMode = useSettingsStore(state => state.editorDefaultMode);
  const setEditorDefaultMode = useSettingsStore(state => state.setEditorDefaultMode);
  const theme = useSettingsStore((state) => state.theme);
  const density = useSettingsStore((state) => state.density);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setDensity = useSettingsStore((state) => state.setDensity);
  const showSidebar = useSettingsStore((state) => state.showSidebarByDefault);
  const showContext = useSettingsStore((state) => state.showContextPanelByDefault);
  const setShowSidebar = useSettingsStore((state) => state.setShowSidebarByDefault);
  const setShowContext = useSettingsStore((state) => state.setShowContextPanelByDefault);
  const installPrompt = usePwaStore((state) => state.installPrompt);
  const install = usePwaStore((state) => state.install);

  return (
    <div className="settings-view">
      <header className="settings-title">
        <h1>Impostazioni</h1>
        <p>Preferenze locali di Nebula. Il Vault non viene modificato.</p>
      </header>

      <section className="settings-section">
        <div className="settings-section-title"><AppWindow size={19} /><div><h2>Editor</h2><p>Modalità iniziale per le note. Durante la sessione viene ricordata la scelta per ogni nota.</p></div></div>
        <label className="setting-row"><div><strong>Apertura note</strong><span>Le nuove note si aprono sempre in Scrivi.</span></div><select value={editorDefaultMode} onChange={e => setEditorDefaultMode(e.target.value as typeof editorDefaultMode)}><option value="edit">Scrivi</option><option value="source">Sorgente</option></select></label>
        <label className="setting-row setting-toggle"><div><strong>Mostra sintassi Markdown al cursore</strong><span>In Scrivi mostra i simboli Markdown vicino al cursore. Disattiva per mantenere il testo sempre formattato.</span></div><input type="checkbox" checked={showMarkdownAtCursor} onChange={event => setShowMarkdownAtCursor(event.target.checked)} /></label>
        <label className="setting-row setting-toggle"><div><strong>Proprietà delle note</strong><span>Mostra il pannello all’apertura di una nota. Puoi nasconderlo dal pulsante Proprietà.</span></div><input type="checkbox" checked={showProperties} onChange={event => setShowProperties(event.target.checked)} /></label>
      </section>
      <section className="settings-section">
        <div className="settings-section-title">
          <AppWindow size={19} />
          <div><h2>Aspetto</h2><p>Tema e densità dell'interfaccia.</p></div>
        </div>
        <div className="setting-row">
          <div><strong>Tema</strong><span>Segui il sistema o scegli un tema fisso.</span></div>
          <div className="segmented-control" role="group" aria-label="Tema">
            {themes.map(({ id, label, icon: Icon }) => (
              <button type="button" aria-pressed={theme === id} className={theme === id ? "is-selected" : ""} key={id} onClick={() => setTheme(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div><strong>Densità UI</strong><span>Regola spaziatura e altezza delle righe.</span></div>
          <div className="segmented-control" role="group" aria-label="Densità UI">
            {densities.map(({ id, label }) => (
              <button type="button" aria-pressed={density === id} className={density === id ? "is-selected" : ""} key={id} onClick={() => setDensity(id)}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <LayoutPanelLeft size={19} />
          <div><h2>Layout</h2><p>Disposizioni ricordate separatamente per note, ricerca e configuratori.</p></div>
        </div>
        <label className="setting-row setting-toggle"><div><strong>Nomi nella navigazione</strong><span>Mostra i nomi completi accanto alle icone su desktop.</span></div><input type="checkbox" checked={navigationExpanded} onChange={event => setNavigationExpanded(event.target.checked)} /></label>
        <label className="setting-row setting-toggle">
          <div><strong>Explorer</strong><span>Disposizione iniziale nelle aree non ancora personalizzate.</span></div>
          <input type="checkbox" checked={showSidebar} onChange={(event) => setShowSidebar(event.target.checked)} />
        </label>
        <label className="setting-row setting-toggle">
          <div><strong>Pannello contestuale</strong><span>Mostra dettagli quando è aperto un documento.</span></div>
          <input type="checkbox" checked={showContext} onChange={(event) => setShowContext(event.target.checked)} />
        </label>
      </section>

      <section className="settings-section"><div className="settings-section-title"><AppWindow size={19}/><div><h2>Vault di prova</h2><p>Note e configuratori dimostrativi, separati dai file personali.</p></div></div><div className="setting-row"><div><strong>Esempi popolati</strong><span>Le modifiche alla prova restano nell’archivio locale del browser.</span></div><button className="button button-secondary" disabled={testVaultBusy} onClick={() => void useVaultStore.getState().openTestVault()}>{testVaultBusy ? "Apertura…" : "Apri Vault di prova"}</button></div>{vaultError && <p className="config-error" role="alert">{vaultError}</p>}<a className="config-text-button" href="/samples/Nebula-Vault-Test.zip" download>Scarica il Vault ZIP</a></section>
      <section className="settings-section">
        <div className="settings-section-title">
          <Info size={19} />
          <div><h2>Informazioni</h2><p>Versione e installazione dell'app.</p></div>
        </div>
        <div className="setting-row">
          <div><strong>Nebula</strong><span>Versione {__APP_VERSION__} · Editor</span></div>
          {installPrompt ? (
            <button className="button button-secondary" type="button" onClick={() => void install()}>
              <Download size={15} /> Installa Nebula
            </button>
          ) : (
            <span className="setting-value">PWA pronta</span>
          )}
        </div>
      </section>
    </div>
  );
}

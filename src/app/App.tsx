import { useEffect } from "react";
import { PwaLifecycle } from "../features/pwa/PwaLifecycle";
import { applyAccent, applyDensity, applyTheme, useSettingsStore } from "../features/settings/settingsStore";
import { AppShell } from "../features/shell/AppShell";
import { useVaultStore } from "../features/vault/vaultStore";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { DocumentLifecycle } from "../features/editor/DocumentLifecycle";
import { vaultService } from "../features/vault/vaultService";

export function App() {
  const initializeVault = useVaultStore((state) => state.initialize);
  const theme = useSettingsStore((state) => state.theme);
  const accentColor = useSettingsStore(state => state.accentColor);
  const density = useSettingsStore((state) => state.density);

  useEffect(() => {
    void initializeVault();
  }, [initializeVault]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible" && useVaultStore.getState().status === "ready") vaultService.scheduleBackup();
    };
    window.addEventListener("focus", check);
    const interval = setInterval(check, 60_000);
    return () => { window.removeEventListener("focus", check); clearInterval(interval); };
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (useSettingsStore.getState().theme === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  useEffect(() => applyAccent(accentColor), [accentColor]);
  useEffect(() => applyDensity(density), [density]);

  return (
    <AppErrorBoundary>
      <PwaLifecycle />
      <DocumentLifecycle />
      <AppShell />
    </AppErrorBoundary>
  );
}

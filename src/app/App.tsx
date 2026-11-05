import { useEffect } from "react";
import { PwaLifecycle } from "../features/pwa/PwaLifecycle";
import { applyDensity, applyTheme, useSettingsStore } from "../features/settings/settingsStore";
import { AppShell } from "../features/shell/AppShell";
import { useVaultStore } from "../features/vault/vaultStore";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { DocumentLifecycle } from "../features/editor/DocumentLifecycle";

export function App() {
  const initializeVault = useVaultStore((state) => state.initialize);
  const theme = useSettingsStore((state) => state.theme);
  const density = useSettingsStore((state) => state.density);

  useEffect(() => {
    void initializeVault();
  }, [initializeVault]);

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (useSettingsStore.getState().theme === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  useEffect(() => applyDensity(density), [density]);

  return (
    <AppErrorBoundary>
      <PwaLifecycle />
      <DocumentLifecycle />
      <AppShell />
    </AppErrorBoundary>
  );
}

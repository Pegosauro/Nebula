import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { type BeforeInstallPromptEvent, usePwaStore } from "./pwaStore";

export function PwaLifecycle() {
  const setInstallPrompt = usePwaStore((state) => state.setInstallPrompt);
  const setUpdateAvailable = usePwaStore((state) => state.setUpdateAvailable);
  const setUpdateServiceWorker = usePwaStore((state) => state.setUpdateServiceWorker);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, [setInstallPrompt]);

  useEffect(() => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setUpdateAvailable(true),
    });
    setUpdateServiceWorker(updateServiceWorker);
  }, [setUpdateAvailable, setUpdateServiceWorker]);

  return null;
}

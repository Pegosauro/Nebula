import { create } from "zustand";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaState {
  installPrompt?: BeforeInstallPromptEvent;
  updateAvailable: boolean;
  updateServiceWorker?: (reloadPage?: boolean) => Promise<void>;
  setInstallPrompt: (event?: BeforeInstallPromptEvent) => void;
  setUpdateAvailable: (available: boolean) => void;
  setUpdateServiceWorker: (updater: (reloadPage?: boolean) => Promise<void>) => void;
  install: () => Promise<void>;
  update: () => Promise<void>;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  updateAvailable: false,
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
  setUpdateServiceWorker: (updateServiceWorker) => set({ updateServiceWorker }),
  install: async () => {
    const prompt = get().installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") set({ installPrompt: undefined });
  },
  update: async () => {
    await get().updateServiceWorker?.(true);
  },
}));

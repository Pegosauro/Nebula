import { readVaultImage, saveVaultImage } from "../../infrastructure/filesystem/vaultImages";
import type { RecentVault, VaultEntry, VaultPermission, VaultScanProgress, VaultSnapshot } from "../../domain/vault";
import { BrowserVaultAdapter } from "../../infrastructure/filesystem/browserVaultAdapter";
import { VaultHandleRepository } from "../../infrastructure/storage/vaultHandleRepository";
import type { ExpectedFileMetadata, TextFileSnapshot } from "../../infrastructure/filesystem/vaultFileOperations";
import { TEMPLATE_DIRECTORY } from "../templates/noteTemplates";

export interface SavedVaultProbe {
  exists: boolean;
  name?: string;
  permission?: VaultPermission;
}

export class VaultService {
  private savedHandle?: FileSystemDirectoryHandle;
  private activeVaultId?: string;
  private browserTestVault = false;
  isBrowserTestVault(): boolean { return this.browserTestVault; }
  private async detectBrowserTestVault(handle: FileSystemDirectoryHandle): Promise<void> {
    this.browserTestVault = false;
    if (!navigator.storage?.getDirectory) return;
    try {
      const demo = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-Vault-Test");
      this.browserTestVault = typeof handle.isSameEntry === "function" && await handle.isSameEntry(demo);
    } catch { /* A normal local Vault need not have a browser demo directory. */ }
  }

  constructor(
    private readonly adapter = new BrowserVaultAdapter(),
    private readonly repository = new VaultHandleRepository(),
  ) {}

  isSupported(): boolean {
    return this.adapter.isSupported();
  }

  async probeSaved(): Promise<SavedVaultProbe> {
    this.savedHandle = await this.repository.get();
    if (!this.savedHandle) return { exists: false };
    await this.detectBrowserTestVault(this.savedHandle);
    return {
      exists: true,
      name: this.savedHandle.name,
      permission: await this.adapter.permission(this.savedHandle),
    };
  }

  async recentVaults(): Promise<RecentVault[]> {
    return (await this.repository.getRecent()).map(({ id, name, lastOpenedAt }) => ({ id, name, lastOpenedAt }));
  }

  async selectRecent(id: string): Promise<SavedVaultProbe> {
    const recent = await this.repository.getRecentById(id);
    if (!recent) throw new Error("Il Vault recente non è più disponibile.");
    this.savedHandle = recent.handle;
    await this.detectBrowserTestVault(recent.handle);
    this.activeVaultId = recent.id;
    await this.repository.setCurrent(recent.handle);
    return {
      exists: true,
      name: recent.name,
      permission: await this.adapter.permission(recent.handle),
    };
  }

  async openTestVault(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    const { createTestVault } = await import("./testVault");
    const handle = await createTestVault();
    const snapshot = await this.adapter.scan(handle, onProgress);
    const recent = await this.repository.set(handle);
    this.savedHandle = handle;
    this.browserTestVault = true;
    this.activeVaultId = recent.id;
    return snapshot;
  }

  async openFromPicker(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    const opened = await this.adapter.pick(onProgress);
    this.savedHandle = opened.handle;
    this.browserTestVault = false;
    const recent = await this.repository.set(opened.handle);
    this.activeVaultId = recent.id;
    return opened.snapshot;
  }

  async resumeSaved(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    if (!this.savedHandle) throw new Error("Il Vault salvato non è più disponibile.");
    const permission = await this.adapter.permission(this.savedHandle);
    if (permission !== "granted") throw new Error("Il Vault richiede una nuova autorizzazione.");
    const snapshot = await this.adapter.scan(this.savedHandle, onProgress);
    const recent = await this.repository.remember(this.savedHandle);
    this.activeVaultId = recent[0]?.id;
    return snapshot;
  }

  async reconnectSaved(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    if (!this.savedHandle) throw new Error("Il Vault salvato non è più disponibile.");
    const permission = await this.adapter.requestPermission(this.savedHandle);
    if (permission !== "granted") throw new Error("L'autorizzazione al Vault non è stata concessa.");
    const snapshot = await this.adapter.scan(this.savedHandle, onProgress);
    const recent = await this.repository.remember(this.savedHandle);
    this.activeVaultId = recent[0]?.id;
    return snapshot;
  }

  private requireHandle(): FileSystemDirectoryHandle {
    if (!this.savedHandle) throw new Error("Il Vault non è più disponibile.");
    return this.savedHandle;
  }

  async createConfigurator(name: string, content: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.createConfigurator(handle, name, content);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createTree(name: string, content: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.createTree(handle, name, content);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createNote(parentPath: string, name: string, content?: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.createNote(handle, parentPath, name, content);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async duplicateNote(entry: VaultEntry, draft?: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.duplicateNote(handle, entry, draft);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async saveTemplate(name: string, content: string, sourcePath: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const { preparePersonalTemplate } = await import("../templates/preparePersonalTemplate");
    const path = await this.adapter.createTemplate(handle, TEMPLATE_DIRECTORY, name, preparePersonalTemplate(content, sourcePath));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createFolder(parentPath: string, name: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.createFolder(handle, parentPath, name);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async rename(entry: VaultEntry, name: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.rename(handle, entry, name);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async move(entry: VaultEntry, targetDirectoryPath: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.adapter.move(handle, entry, targetDirectoryPath);
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async delete(entry: VaultEntry): Promise<VaultSnapshot> {
    const handle = this.requireHandle();
    await this.adapter.delete(handle, entry);
    return this.adapter.scan(handle);
  }

  readText(path: string): Promise<TextFileSnapshot> {
    return this.adapter.readText(this.requireHandle(), path);
  }

  statText(path: string): Promise<ExpectedFileMetadata> {
    return this.adapter.statText(this.requireHandle(), path);
  }

  writeText(path: string, content: string, expected?: ExpectedFileMetadata): Promise<ExpectedFileMetadata> {
    return this.adapter.writeText(this.requireHandle(), path, content, expected);
  }

  readImage(path: string): Promise<Blob> {
    return readVaultImage(this.requireHandle(), path);
  }

  saveImage(sourcePath: string, file: File): Promise<string> {
    return saveVaultImage(this.requireHandle(), sourcePath, file);
  }

  currentVaultId(): string | undefined {
    return this.activeVaultId;
  }

  async disconnect(): Promise<void> {
    this.savedHandle = undefined;
    this.activeVaultId = undefined;
    this.browserTestVault = false;
    await this.repository.clear();
  }
}

export const vaultService = new VaultService();

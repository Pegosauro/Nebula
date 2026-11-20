import { openTaskFile } from "../tasks/taskFile";
import { isVaultAttachment, readVaultImage, saveVaultImage } from "../../infrastructure/filesystem/vaultImages";
import { imageTrashDirectory, restoreTrashedImage, trashImageIfUnused } from "../../infrastructure/filesystem/imageTrash";
import type { RecentVault, VaultEntry, VaultPermission, VaultScanProgress, VaultSnapshot } from "../../domain/vault";
import { BrowserVaultAdapter } from "../../infrastructure/filesystem/browserVaultAdapter";
import { VaultHandleRepository } from "../../infrastructure/storage/vaultHandleRepository";
import type { ExpectedFileMetadata, TextFileSnapshot } from "../../infrastructure/filesystem/vaultFileOperations";
import { VaultBackupManager, type VaultBackupStatus } from "./vaultBackupManager";
import type { VaultBackupChoice, VaultBackupReview } from "../../infrastructure/filesystem/vaultBackup";
import { TEMPLATE_DIRECTORY } from "../templates/noteTemplates";

export interface SavedVaultProbe {
  exists: boolean;
  name?: string;
  permission?: VaultPermission;
}

export class VaultService {
  private savedHandle?: FileSystemDirectoryHandle;
  private activeHandle?: FileSystemDirectoryHandle;
  private primaryVaultId?: string;
  private readonly backup: VaultBackupManager;
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
  ) { this.backup = new VaultBackupManager(adapter, repository); }

  isSupported(): boolean {
    return this.adapter.isSupported();
  }

  async probeSaved(): Promise<SavedVaultProbe> {
    const saved = await this.repository.getConnection();
    this.savedHandle = saved?.handle;
    this.primaryVaultId = saved?.id;
    await this.backup.connect(this.savedHandle, this.primaryVaultId);
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
    this.activeHandle = undefined;
    this.primaryVaultId = recent.id;
    await this.repository.setCurrent(recent.handle, recent.id);
    await this.backup.connect(recent.handle, recent.id);
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
    await this.activatePrimary(handle, recent.id);
    return snapshot;
  }

  async openFromPicker(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    const opened = await this.adapter.pick(onProgress);
    this.savedHandle = opened.handle;
    this.browserTestVault = false;
    const recent = await this.repository.set(opened.handle);
    await this.activatePrimary(opened.handle, recent.id);
    return opened.snapshot;
  }

  async resumeSaved(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    if (!this.savedHandle) throw new Error("Il Vault salvato non è più disponibile.");
    const permission = await this.adapter.permission(this.savedHandle);
    if (permission !== "granted") throw new Error("Il Vault richiede una nuova autorizzazione.");
    const snapshot = await this.adapter.scan(this.savedHandle, onProgress);
    await this.resumePrimary(this.savedHandle);
    return snapshot;
  }

  async reconnectSaved(onProgress?: (progress: VaultScanProgress) => void): Promise<VaultSnapshot> {
    if (!this.savedHandle) throw new Error("Il Vault salvato non è più disponibile.");
    const permission = await this.adapter.requestPermission(this.savedHandle);
    if (permission !== "granted") throw new Error("L'autorizzazione al Vault non è stata concessa.");
    const snapshot = await this.adapter.scan(this.savedHandle, onProgress);
    await this.resumePrimary(this.savedHandle);
    return snapshot;
  }

  private async activatePrimary(handle: FileSystemDirectoryHandle, id: string) {
    await this.backup.connect(handle, id);
    this.activeHandle = handle;
    this.primaryVaultId = id;
    this.backup.schedule(400, true);
  }

  private async resumePrimary(handle: FileSystemDirectoryHandle) {
    const recent = (await this.repository.remember(handle, this.primaryVaultId))[0]!;
    if (!this.primaryVaultId) await this.repository.setCurrent(handle, recent.id);
    await this.activatePrimary(handle, recent.id);
  }

  private requireHandle(): FileSystemDirectoryHandle {
    if (!this.activeHandle) throw new Error("Il Vault non è più disponibile.");
    return this.activeHandle;
  }

  private write<T>(handle: FileSystemDirectoryHandle, operation: () => Promise<T>): Promise<T> {
    return this.backup.write(() => {
      if (handle !== this.activeHandle) throw new Error("Il Vault è cambiato. Riprova nella cartella attiva.");
      return operation();
    }, handle !== this.savedHandle);
  }

  observeBackup(listener: (status?: VaultBackupStatus) => void) { this.backup.subscribe(listener); }
  configureBackup() { return this.backup.configure(); }
  disableBackup() { return this.backup.disable(); }
  syncBackup() { return this.backup.synchronize(true, true); }
  scheduleBackup() { this.backup.schedule(); }
  authorizeBackup() { return this.backup.authorizeBackup(); }
  authorizePrimary() { return this.backup.authorizePrimary(); }

  async openBackup() {
    const { handle, snapshot } = await this.backup.open();
    this.activeHandle = handle;
    return snapshot;
  }

  reviewBackup() { return this.backup.review(); }
  previewBackupFile(path: string) { return this.backup.preview(path); }

  async applyBackup(review: VaultBackupReview, choices: ReadonlyMap<string, VaultBackupChoice>) {
    const snapshot = await this.backup.apply(review, choices);
    this.activeHandle = this.savedHandle;
    return snapshot;
  }

  refreshActive(onProgress?: (progress: VaultScanProgress) => void) {
    return this.adapter.scan(this.requireHandle(), onProgress);
  }

  async createConfigurator(name: string, content: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.createConfigurator(handle, name, content));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createTree(name: string, content: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.createTree(handle, name, content));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createNote(parentPath: string, name: string, content?: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.createNote(handle, parentPath, name, content));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async duplicateNote(entry: VaultEntry, draft?: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.duplicateNote(handle, entry, draft));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async saveTemplate(name: string, content: string, sourcePath: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const { preparePersonalTemplate } = await import("../templates/preparePersonalTemplate");
    const path = await this.write(handle, () => this.adapter.createTemplate(handle, TEMPLATE_DIRECTORY, name, preparePersonalTemplate(content, sourcePath)));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async createFolder(parentPath: string, name: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.createFolder(handle, parentPath, name));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async rename(entry: VaultEntry, name: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.rename(handle, entry, name));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async move(entry: VaultEntry, targetDirectoryPath: string): Promise<{ path: string; snapshot: VaultSnapshot }> {
    const handle = this.requireHandle();
    const path = await this.write(handle, () => this.adapter.move(handle, entry, targetDirectoryPath));
    return { path, snapshot: await this.adapter.scan(handle) };
  }

  async delete(entry: VaultEntry): Promise<VaultSnapshot> {
    const handle = this.requireHandle();
    await this.write(handle, () => this.adapter.delete(handle, entry));
    return this.adapter.scan(handle);
  }

  readText(path: string): Promise<TextFileSnapshot> {
    return this.adapter.readText(this.requireHandle(), path);
  }

  statText(path: string): Promise<ExpectedFileMetadata> {
    return this.adapter.statText(this.requireHandle(), path);
  }

  writeText(path: string, content: string, expected?: ExpectedFileMetadata): Promise<ExpectedFileMetadata> {
    const handle = this.requireHandle();
    return this.write(handle, () => this.adapter.writeText(handle, path, content, expected));
  }

  async writeTextWithImages(path: string, content: string, expected: ExpectedFileMetadata | undefined,
    changes: ReadonlyMap<string, boolean>, referencedInDraft: (attachment: string) => boolean,
  ): Promise<{ metadata: ExpectedFileMetadata; imageWarning?: string }> {
    const handle = this.requireHandle();
    const assertActive = () => {
      if (handle !== this.activeHandle) throw new Error("Il Vault è cambiato. Riprova nella cartella attiva.");
    };
    return this.write(handle, async () => {
      for (const [attachment, kept] of changes) if (kept) await restoreTrashedImage(handle, attachment, assertActive);
      assertActive();
      const metadata = await this.adapter.writeText(handle, path, content, expected);
      let imageWarning: string | undefined;
      for (const [attachment, kept] of changes) {
        if (kept) continue;
        try { await trashImageIfUnused(handle, attachment, () => referencedInDraft(attachment), assertActive); }
        catch { imageWarning = "Nota salvata. Non è stato possibile spostare un allegato nel cestino."; }
      }
      return { metadata, imageWarning };
    });
  }

  async readImage(path: string): Promise<Blob> {
    const handle = this.requireHandle();
    try { return await readVaultImage(handle, path); }
    catch (error) {
      if (!(error instanceof DOMException) || error.name !== "NotFoundError" || !isVaultAttachment(path)) throw error;
      // Undo can redraw the image before the next document save makes the move
      // out of the trash. Read the saved copy during that interval.
      try { return await readVaultImage(handle, `${imageTrashDirectory}/${path}`); }
      catch (trashError) {
        if (!(trashError instanceof DOMException) || trashError.name !== "NotFoundError") throw trashError;
        return readVaultImage(handle, path);
      }
    }
  }

  saveImage(sourcePath: string, file: File): Promise<string> {
    const handle = this.requireHandle();
    return this.write(handle, () => saveVaultImage(handle, sourcePath, file));
  }

  taskFile(vaultId: string) {
    const active = () => {
      if (vaultId !== this.currentVaultId()) throw new Error("Il Vault delle task non è collegato.");
      return this.requireHandle();
    };
    return {
      read: () => openTaskFile(active(), vaultId).read(),
      write: (content: string, expected: string | null) => {
        const handle = active();
        return this.write(handle, () => openTaskFile(handle, vaultId).write(content, expected));
      },
    };
  }

  currentVaultId(): string | undefined {
    if (!this.primaryVaultId || !this.activeHandle) return undefined;
    return this.activeHandle === this.savedHandle ? this.primaryVaultId : `${this.primaryVaultId}:backup`;
  }

  async disconnect(): Promise<void> {
    this.savedHandle = undefined;
    this.activeHandle = undefined;
    this.primaryVaultId = undefined;
    await this.backup.connect();
    this.browserTestVault = false;
    await this.repository.clear();
  }
}

export const vaultService = new VaultService();

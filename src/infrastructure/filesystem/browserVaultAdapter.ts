import type { VaultPermission, VaultScanProgress, VaultSnapshot } from "../../domain/vault";
import { scanDirectoryHandle } from "./scanDirectory";
import { VaultFileOperations, type ExpectedFileMetadata, type TextFileSnapshot } from "./vaultFileOperations";
import type { VaultEntry } from "../../domain/vault";

export interface OpenedVault {
  handle: FileSystemDirectoryHandle;
  snapshot: VaultSnapshot;
}

export class BrowserVaultAdapter {
  private readonly operations = new VaultFileOperations();
  isSupported(): boolean {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  }

  async pick(onProgress?: (progress: VaultScanProgress) => void): Promise<OpenedVault> {
    if (!window.showDirectoryPicker) {
      throw new Error("Il browser non supporta l'accesso diretto alle cartelle locali.");
    }

    const handle = await window.showDirectoryPicker({
      id: "nebula-vault",
      mode: "readwrite",
    });

    return { handle, snapshot: await scanDirectoryHandle(handle, { onProgress }) };
  }

  async permission(handle: FileSystemDirectoryHandle): Promise<VaultPermission> {
    return typeof handle.queryPermission === "function" ? handle.queryPermission({ mode: "readwrite" }) : "granted";
  }

  async requestPermission(handle: FileSystemDirectoryHandle): Promise<VaultPermission> {
    return typeof handle.requestPermission === "function" ? handle.requestPermission({ mode: "readwrite" }) : "granted";
  }

  async scan(
    handle: FileSystemDirectoryHandle,
    onProgress?: (progress: VaultScanProgress) => void,
  ): Promise<VaultSnapshot> {
    return scanDirectoryHandle(handle, { onProgress });
  }

  createConfigurator(handle: FileSystemDirectoryHandle, name: string, content: string): Promise<string> {
    return this.operations.createConfigurator(handle, name, content);
  }

  createNote(handle: FileSystemDirectoryHandle, parentPath: string, name: string, content?: string): Promise<string> {
    return this.operations.createNote(handle, parentPath, name, content);
  }

  createTemplate(handle: FileSystemDirectoryHandle, directoryName: string, name: string, content: string): Promise<string> {
    return this.operations.createTemplate(handle, directoryName, name, content);
  }

  duplicateNote(handle: FileSystemDirectoryHandle, entry: VaultEntry, draft?: string): Promise<string> {
    return this.operations.duplicateNote(handle, entry, draft);
  }

  createFolder(handle: FileSystemDirectoryHandle, parentPath: string, name: string): Promise<string> {
    return this.operations.createFolder(handle, parentPath, name);
  }

  rename(handle: FileSystemDirectoryHandle, entry: VaultEntry, name: string): Promise<string> {
    return this.operations.rename(handle, entry, name);
  }

  move(handle: FileSystemDirectoryHandle, entry: VaultEntry, targetDirectoryPath: string): Promise<string> {
    return this.operations.move(handle, entry, targetDirectoryPath);
  }

  delete(handle: FileSystemDirectoryHandle, entry: VaultEntry): Promise<void> {
    return this.operations.delete(handle, entry);
  }

  readText(handle: FileSystemDirectoryHandle, path: string): Promise<TextFileSnapshot> {
    return this.operations.readText(handle, path);
  }

  statText(handle: FileSystemDirectoryHandle, path: string): Promise<ExpectedFileMetadata> {
    return this.operations.statText(handle, path);
  }

  writeText(handle: FileSystemDirectoryHandle, path: string, content: string, expected?: ExpectedFileMetadata): Promise<ExpectedFileMetadata> {
    return this.operations.writeText(handle, path, content, expected);
  }
}

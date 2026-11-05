import { extensionOf, joinVaultPath } from "../../domain/path";
import {
  DEFAULT_IGNORED_DIRECTORIES,
  type VaultEntry,
  type VaultScanProgress,
  type VaultSnapshot,
  type VaultStats,
} from "../../domain/vault";

interface ScanOptions {
  ignoredDirectories?: ReadonlySet<string>;
  onProgress?: (progress: VaultScanProgress) => void;
  yieldEvery?: number;
}

function createStats(): VaultStats {
  return { directories: 0, files: 0, notes: 0, boards: 0 };
}

function compareEntries(left: VaultEntry, right: VaultEntry): number {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

export async function scanDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  options: ScanOptions = {},
): Promise<VaultSnapshot> {
  const ignoredDirectories = options.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES;
  const yieldEvery = options.yieldEvery ?? 100;
  const stats = createStats();
  let processed = 0;

  const scanLevel = async (directory: FileSystemDirectoryHandle, parentPath: string): Promise<VaultEntry[]> => {
    const entries: VaultEntry[] = [];

    for await (const [name, childHandle] of directory.entries()) {
      if (childHandle.kind === "directory" && ignoredDirectories.has(name)) continue;

      const path = joinVaultPath(parentPath, name);
      processed += 1;
      options.onProgress?.({ phase: "scan", current: processed, path });

      if (childHandle.kind === "directory") {
        stats.directories += 1;
        entries.push({
          id: path,
          name,
          path,
          type: "directory",
          extension: "",
          children: await scanLevel(childHandle, path),
        });
      } else {
        const file = await childHandle.getFile();
        const extension = extensionOf(name);
        stats.files += 1;
        if (extension === ".md") stats.notes += 1;
        if (extension === ".excalidraw") stats.boards += 1;
        entries.push({
          id: path,
          name,
          path,
          type: "file",
          extension,
          size: file.size,
          modifiedAt: file.lastModified,
        });
      }

      if (processed % yieldEvery === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    return entries.sort(compareEntries);
  };

  return {
    name: handle.name,
    root: await scanLevel(handle, ""),
    stats,
    scannedAt: Date.now(),
  };
}

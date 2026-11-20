import type { BrowserVaultAdapter } from "../../infrastructure/filesystem/browserVaultAdapter";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { VaultBackupFiles, type VaultBackupChoice, type VaultBackupRecord, type VaultBackupReview } from "../../infrastructure/filesystem/vaultBackup";
import type { VaultHandleRepository } from "../../infrastructure/storage/vaultHandleRepository";

type Connection = { id: string; primary: FileSystemDirectoryHandle };
export interface VaultBackupStatus {
  name: string;
  syncedAt: number;
  pending: boolean;
  usingBackup: boolean;
  error?: string;
}

export class VaultBackupManager {
  private readonly files = new VaultBackupFiles();
  private connection?: Connection;
  private record?: VaultBackupRecord;
  private usingBackup = false;
  private timer?: ReturnType<typeof setTimeout>;
  private listener?: (status?: VaultBackupStatus) => void;
  private error?: string;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly adapter: BrowserVaultAdapter, private readonly repository: VaultHandleRepository) {}

  subscribe(listener: (status?: VaultBackupStatus) => void) {
    this.listener = listener;
  }

  private publish() {
    const { record, usingBackup, error } = this;
    this.listener?.(record && { name: record.handle.name, syncedAt: record.syncedAt, pending: record.pending, usingBackup, error });
  }

  async connect(primary?: FileSystemDirectoryHandle, id?: string) {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.connection = primary && id ? { primary, id } : undefined;
    this.usingBackup = false;
    this.error = undefined;
    this.record = id ? await this.repository.getBackup(id) : undefined;
    this.publish();
  }

  private requireConnection() {
    if (!this.connection) throw new Error("Apri prima il Vault principale.");
    return this.connection;
  }

  private lock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (navigator.locks) return navigator.locks.request(`nebula:vault-backup:${id}`, operation);
    const previous = this.queues.get(id);
    const running = (previous ?? Promise.resolve()).then(operation);
    const barrier = running.then(() => undefined, () => undefined);
    this.queues.set(id, barrier);
    void barrier.then(() => { if (this.queues.get(id) === barrier) this.queues.delete(id); });
    return running;
  }

  private async update(connection: Connection, record?: VaultBackupRecord) {
    if (record) await this.repository.setBackup(connection.id, record);
    else await this.repository.removeBackup(connection.id);
    if (connection !== this.connection) return;
    this.record = record;
    this.error = undefined;
    this.publish();
  }

  private async load(connection: Connection) {
    const stored = await this.repository.getBackup(connection.id);
    const record = stored && this.record?.id === stored.id ? { ...stored, handle: this.record.handle } : stored;
    if (connection === this.connection) {
      this.record = record;
      this.publish();
    }
    return record;
  }

  private async requirePermission(handle: FileSystemDirectoryHandle, request: boolean, role: string) {
    const permission = await (request ? this.adapter.requestPermission(handle) : this.adapter.permission(handle));
    if (permission !== "granted") throw new Error(`Autorizza l’accesso alla cartella ${role} e riprova.`);
  }

  async configure() {
    const connection = this.requireConnection();
    if (this.usingBackup || this.record) throw new Error("Il backup è già configurato per questo Vault.");
    if (!window.showDirectoryPicker) throw new Error("Il browser non supporta l’accesso diretto alle cartelle locali.");
    const destination = await window.showDirectoryPicker({ id: "nebula-vault-backup", mode: "readwrite" });
    await this.lock(connection.id, async () => {
      if (connection !== this.connection || await this.load(connection)) throw new Error("Il Vault o la configurazione del backup è cambiato.");
      await this.update(connection, await this.files.create(connection.primary, destination));
    });
  }

  async disable() {
    const connection = this.requireConnection();
    await this.lock(connection.id, async () => {
      const record = await this.load(connection);
      if (this.usingBackup || record?.pending) throw new Error("Completa il recupero prima di scollegare il backup.");
      await this.update(connection);
    });
  }

  async open() {
    const connection = this.requireConnection();
    const selected = this.record;
    if (!selected) throw new Error("Non c’è un backup configurato per questo Vault.");
    await this.requirePermission(selected.handle, true, "di backup");
    return this.lock(connection.id, async () => {
      const record = await this.load(connection);
      if (!record || connection !== this.connection || record.id !== selected.id) {
        throw new Error("Il Vault o la configurazione del backup è cambiato.");
      }
      const snapshot = await this.adapter.scan(selected.handle);
      await this.update(connection, { ...record, pending: true });
      this.usingBackup = true;
      this.publish();
      return { handle: selected.handle, snapshot };
    });
  }

  async synchronize(request = false, strong = false) {
    const connection = this.requireConnection();
    const handle = this.record?.handle;
    if (!handle || this.usingBackup) return;
    if (request) await this.requirePermission(handle, true, "di backup");
    await this.lock(connection.id, async () => {
      const record = await this.load(connection);
      if (!record || record.pending || this.usingBackup || connection !== this.connection) return;
      await this.requirePermission(record.handle, false, "di backup");
      await this.update(connection, await this.files.sync(connection.primary, record, strong));
    });
  }

  schedule(delay = 1500, strong = false) {
    if (!this.record || !this.connection || this.usingBackup) return;
    if (this.timer && !strong) return;
    const connection = this.connection;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.synchronize(false, strong).catch(error => {
        if (connection !== this.connection) return;
        this.error = readableFileSystemError(error);
        this.publish();
      });
    }, delay);
  }

  async authorizePrimary() {
    const connection = this.requireConnection();
    await this.requirePermission(connection.primary, true, "principale");
  }

  async review(): Promise<VaultBackupReview> {
    const connection = this.requireConnection();
    return this.lock(connection.id, async () => {
      const record = await this.load(connection);
      if (!record || connection !== this.connection) throw new Error("La configurazione del backup è cambiata.");
      await this.requirePermission(record.handle, false, "di backup");
      return this.files.review(connection.primary, record);
    });
  }

  async apply(review: VaultBackupReview, choices: ReadonlyMap<string, VaultBackupChoice>) {
    const connection = this.requireConnection();
    return this.lock(connection.id, async () => {
      const record = await this.load(connection);
      if (!record || connection !== this.connection) throw new Error("La configurazione del backup è cambiata.");
      // Persist the recovery state before the first write, including after a partial failure.
      const working = { ...record, pending: true };
      await this.update(connection, working);
      const next = await this.files.apply(connection.primary, working, review.revision, choices);
      const snapshot = await this.adapter.scan(connection.primary);
      await this.update(connection, next);
      this.usingBackup = false;
      this.publish();
      return snapshot;
    });
  }

  async preview(path: string) {
    const connection = this.requireConnection();
    if (!this.record) throw new Error("Il backup non è più collegato.");
    return Promise.all([this.files.preview(connection.primary, path), this.files.preview(this.record.handle, path)]);
  }

  async authorizeBackup() {
    if (!this.record) return;
    await this.requirePermission(this.record.handle, true, "di backup");
  }

  async write<T>(operation: () => Promise<T>, activeIsBackup: boolean): Promise<T> {
    const connection = this.connection;
    if (!connection) return operation();
    return this.lock(connection.id, async () => {
      if (connection !== this.connection || activeIsBackup !== this.usingBackup) throw new Error("Il Vault è cambiato. Riprova nella cartella attiva.");
      if (activeIsBackup && !(await this.load(connection))?.pending) {
        throw new Error("Il ripristino è stato completato in un’altra scheda. Riapri il Vault principale.");
      }
      const result = await operation();
      this.schedule();
      return result;
    });
  }
}

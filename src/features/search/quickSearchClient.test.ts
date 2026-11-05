import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickSearchClient, quickCatalog, type QuickSearchRequest } from "./quickSearchClient";
import type { SearchResult } from "../../domain/search";

afterEach(() => { vi.unstubAllGlobals(); });
const result = (path: string): SearchResult => ({ path, title: path, breadcrumb: "Vault", snippet: "", aliases: [], tags: [], score: 1, match: "title" });
class WorkerProbe {
  sent: QuickSearchRequest[] = [];
  handlers = new Map<string, (event: { data: unknown }) => void>();
  addEventListener(type: string, handler: (event: { data: unknown }) => void) { this.handlers.set(type, handler); }
  postMessage(message: QuickSearchRequest) { this.sent.push(message); }
  terminate() {}
  reply(id: number, results: SearchResult[]) { this.handlers.get("message")!({ data: { id, results } }); }
}

describe("independent quick search", () => {
  it("finds names before content indexing and enriches titles and aliases without reading files", async () => {
    const entries = [{ id: "a", path: "Cartella", name: "Cartella", type: "directory" as const, extension: "", children: [{ id: "n", name: "Misure.md", path: "Cartella/Misure.md", extension: ".md", type: "file" as const }] }];
    const client = new QuickSearchClient(); client.replace(quickCatalog(entries, {}));
    expect((await client.search("mis", []))[0]?.path).toBe("Cartella/Misure.md");
    client.replace(quickCatalog(entries, { "Cartella/Misure.md": { path: "Cartella/Misure.md", title: "Specifiche tecniche", aliases: ["Dimensioni"], incoming: [], outgoing: [] } }));
    expect((await client.search("dimensioni", []))[0]?.title).toBe("Specifiche tecniche");
    client.replace([]); expect(await client.search("dimensioni", [])).toEqual([]);
  });
  it("keeps at most one active and one latest query, and caches repeated results", async () => {
    const worker = new WorkerProbe(); vi.stubGlobal("Worker", function () { return worker; });
    const client = new QuickSearchClient(); client.replace([{ path: "Alpha.md" }]);
    const a = client.search("a", []), ab = client.search("ab", []), abc = client.search("abc", []);
    expect(worker.sent.filter(item => item.type === "search")).toHaveLength(1);
    expect(await ab).toEqual([]);
    const first = worker.sent.find(item => item.type === "search")!;
    if (first.type !== "search") throw new Error("Missing search");
    worker.reply(first.id, [result("A.md")]); await a;
    const last = worker.sent.at(-1)!;
    expect(last).toMatchObject({ type: "search", query: "abc" });
    if (last.type !== "search") throw new Error("Missing search");
    worker.reply(last.id, [result("ABC.md")]); expect((await abc)[0]?.path).toBe("ABC.md");
    const count = worker.sent.length;
    expect((await client.search("abc", []))[0]?.path).toBe("ABC.md"); expect(worker.sent).toHaveLength(count);
  });
  it("rejects stale results after replacing a Vault and cancels pending work on close", async () => {
    const worker = new WorkerProbe(); vi.stubGlobal("Worker", function () { return worker; });
    const client = new QuickSearchClient(); client.replace([{ path: "Old.md" }]);
    const pending = client.search("old", []), queued = client.search("older", []);
    client.cancelQueued(); expect(await queued).toEqual([]);
    client.replace([{ path: "New.md" }]);
    const active = worker.sent.find(item => item.type === "search")!;
    if (active.type !== "search") throw new Error("Missing search");
    worker.reply(active.id, [result("Old.md")]); expect(await pending).toEqual([]);
    expect(worker.sent.filter(item => item.type === "search")).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { demoTree } from "./demoTree";
import { buildOutline, virtualWindow } from "./outline";

describe("vista dell'albero", () => {
  it("attenua i nodi fuori filtro senza nasconderli e conta le corrispondenze", () => {
    const tree = demoTree();
    const open = new Set(tree.nodes.map(node => node.id));
    const all = buildOutline(tree, open, "");
    expect(all.rows.filter(row => row.kind === "node")).toHaveLength(tree.nodes.length);
    expect(all.rows.some(row => row.dimmed)).toBe(false);
    const filtered = buildOutline(tree, open, "larghezza", "c-dim");
    expect(filtered.matchCount).toBeGreaterThan(0);
    expect(filtered.rows.some(row => row.kind === "node" && row.dimmed)).toBe(true);
    expect(filtered.rows.filter(row => row.kind === "node")).toHaveLength(tree.nodes.length);
    const objects = buildOutline(tree, new Set(["n-root", "n-08", "n-0804"]), "", undefined);
    expect(objects.rows.some(row => row.kind === "object" && row.id === "o-1")).toBe(true);
  });

  it("tiene la radice sempre espansa anche se lo stato salvato la chiude", () => {
    const tree = demoTree();
    const closed = buildOutline(tree, new Set(), "");
    const root = closed.rows.find(row => row.kind === "node" && row.id === "n-root");
    expect(root?.kind === "node" && root.expanded).toBe(true);
    expect(closed.rows.some(row => row.kind === "node" && row.id === "n-01")).toBe(true);
    expect(closed.rows.some(row => row.kind === "node" && row.id === "n-0701")).toBe(false);
  });

  it("virtualizza solo oltre mille righe", () => {
    expect(virtualWindow(40, 0, 300)).toEqual({ start: 0, end: 40 });
    const window = virtualWindow(1500, 0, 360);
    expect(window.end).toBeLessThan(80);
    expect(virtualWindow(1500, 3600, 360).start).toBeGreaterThan(50);
  });
});

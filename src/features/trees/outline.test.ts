import { describe, expect, it } from "vitest";
import { demoTree } from "./demoTree";
import { buildOutline, virtualWindow } from "./outline";

describe("vista dell'albero", () => {
  it("nasconde i nodi fuori filtro e consente di mostrarli attenuati", () => {
    const tree = demoTree();
    const open = new Set(tree.nodes.map(node => node.id));
    const all = buildOutline(tree, open, "");
    expect(all.rows.filter(row => row.kind === "node")).toHaveLength(tree.nodes.length);
    expect(all.rows.some(row => row.dimmed)).toBe(false);
    const filtered = buildOutline(tree, open, "larghezza", "c-dim");
    expect(filtered.matchCount).toBeGreaterThan(0);
    expect(filtered.rows.every(row => row.kind !== "node" || row.matched)).toBe(true);
    expect(filtered.rows.filter(row => row.kind === "node")).toHaveLength(filtered.matchCount);
    const context = buildOutline(tree, open, "larghezza", "c-dim", true);
    expect(context.rows.some(row => row.kind === "node" && row.dimmed)).toBe(true);
    expect(context.rows.filter(row => row.kind === "node")).toHaveLength(tree.nodes.length);
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

  it("raggiunge i figli corrispondenti anche sotto padri nascosti e combina più categorie", () => {
    const tree = demoTree();
    const dim = buildOutline(tree, new Set(), "", ["c-dim"]);
    const ids = dim.rows.filter(row => row.kind === "node").map(row => row.id);
    expect(ids).toContain("n-0701");
    expect(ids).not.toContain("n-root");
    expect(dim.rows.find(row => row.id === "n-07")?.depth).toBe(1);
    expect(dim.rows.find(row => row.id === "n-0701")?.depth).toBe(2);
    const combined = buildOutline(tree, new Set(), "", ["c-dim", "c-avv"]);
    expect(combined.rows.some(row => row.id === "n-47")).toBe(true);
    expect(combined.matchCount).toBeGreaterThan(dim.matchCount);
    expect(buildOutline(tree, new Set(), "", ["inesistente"]).rows).toEqual([]);
  });

  it("virtualizza solo oltre mille righe", () => {
    expect(virtualWindow(40, 0, 300)).toEqual({ start: 0, end: 40 });
    const window = virtualWindow(1500, 0, 360);
    expect(window.end).toBeLessThan(80);
    expect(virtualWindow(1500, 3600, 360).start).toBeGreaterThan(50);
  });
});

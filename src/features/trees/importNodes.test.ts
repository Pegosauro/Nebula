import { describe, expect, it } from "vitest";
import { demoTree } from "./demoTree";
import { hasImportHeader, planNodeImport } from "./importNodes";
import { inspectTree, newTree, parseTree, type TreeNode } from "./model";
import { serializeTreeFile } from "./serializeTree";

const options = { header: false, createCategories: false };
describe("incolla nodi da Excel", () => {
  it("richiede solo il nome e genera codici liberi senza toccare i nodi presenti", () => {
    const tree = demoTree();
    const before = serializeTreeFile(tree);
    const plan = planNodeImport(tree, "n-07", "Profilo\nAccessorio\n\n", options);
    expect(plan.errors).toEqual([]);
    expect(plan.rows.map(row => row.code)).toEqual(["FL-0703", "FL-0704"]);
    expect(plan.tree?.nodes.slice(-2).map(node => [node.name, node.categoryId, node.note, node.categoryMode])).toEqual([["Profilo", null, "", "own"], ["Accessorio", null, "", "own"]]);
    expect(serializeTreeFile(tree)).toBe(before);
    expect(inspectTree(plan.tree!).errors).toEqual([]);
    expect(plan.tree?.nodes.slice(0, tree.nodes.length)).toEqual(tree.nodes);
  });
  it("riconosce intestazioni e categorie senza distinzione di maiuscole", () => {
    const text = "Nome\tCategoria\tNote\r\nPrimo\t dimensioni \tNota\r\nSecondo\t\t";
    expect(hasImportHeader(text)).toBe(true);
    const plan = planNodeImport(demoTree(), "n-07", text, { ...options, header: true });
    expect(plan.rows.map(row => row.name)).toEqual(["Primo", "Secondo"]);
    expect(plan.tree?.nodes.at(-2)?.categoryId).toBe("c-dim");
    expect(plan.tree?.nodes.at(-2)?.note).toBe("Nota");
    expect(plan.tree?.nodes.at(-1)?.categoryId).toBeNull();
    expect(plan.tree?.nodes.at(-1)?.note).toBe("");
    expect(plan.rows[0]?.row).toBe(2);
    expect(planNodeImport(demoTree(), "n-07", "Nome\nPrimo", options).rows.map(row => row.name)).toEqual(["Nome", "Primo"]);
  });
  it("conserva note multilinea, tabulazioni nelle celle e virgolette di Excel", () => {
    const text = 'Profilo\tDimensioni\t"Prima riga\nSeconda\tcon ""virgolette"""\r\nAccessorio';
    const plan = planNodeImport(demoTree(), "n-07", text, options);
    expect(plan.tree).toBeDefined();
    expect(plan.rows[0]?.note).toBe('Prima riga\nSeconda\tcon "virgolette"');
    expect(plan.rows).toHaveLength(2);
    const saved = parseTree(serializeTreeFile(plan.tree!));
    expect(saved.nodes.at(-2)?.note).toBe(plan.rows[0]?.note);
  });
  it("blocca l'intero inserimento per nomi mancanti, colonne extra o virgolette incomplete", () => {
    const missing = planNodeImport(demoTree(), "n-07", "Valido\n\tDimensioni\tNota", options);
    expect(missing.tree).toBeUndefined();
    expect(missing.rows[1]?.errors).toContain("Il nome è obbligatorio.");
    expect(missing.rows[1]?.row).toBe(2);
    expect(planNodeImport(demoTree(), "n-07", "Uno\tDimensioni\tNota\tExtra", options).tree).toBeUndefined();
    const broken = planNodeImport(demoTree(), "n-07", 'Uno\t\t"Nota senza fine', options);
    expect(broken.errors[0]).toContain("virgolette non chiuse"); expect(broken.tree).toBeUndefined();
    expect(planNodeImport(demoTree(), "n-07", "\t\t\n", options).tree).toBeUndefined();
  });
  it("crea categorie nuove solo con scelta esplicita e riusa quelle ripetute", () => {
    const text = "Primo\tNuova famiglia\tNota\nSecondo\tNUOVA FAMIGLIA";
    expect(planNodeImport(demoTree(), "n-07", text, options).tree).toBeUndefined();
    const plan = planNodeImport(demoTree(), "n-07", text, { ...options, createCategories: true });
    expect(plan.newCategories).toEqual(["Nuova famiglia"]);
    expect(plan.tree?.nodes.at(-1)?.categoryId).toBe(plan.tree?.nodes.at(-2)?.categoryId);
    expect(plan.tree?.categories).toHaveLength(demoTree().categories.length + 1);
    expect(inspectTree(plan.tree!).errors).toEqual([]);
    const duplicate = demoTree(); duplicate.categories.push({ ...duplicate.categories[1]!, id: "dim-duplicate", name: "DIMENSIONI" });
    expect(planNodeImport(duplicate, "n-07", "Primo\tDimensioni", { ...options, createCategories: true }).rows[0]?.errors[0]).toContain("ambigua");
  });
  it("evita codici occupati globalmente e aggiunge i nodi in coda senza riordinare gli altri", () => {
    const tree = newTree("Prova", "R", "Radice");
    const node = (id: string, code: string, order: number, parentId = tree.rootId): TreeNode => ({ ...tree.nodes[0]!, id, code, order, parentId });
    tree.nodes.push(node("first", "R-01", 7), node("other", "X", 40), node("collision", "R-02", 0, "other"));
    const plan = planNodeImport(tree, tree.rootId, "Primo\nSecondo", options);
    expect(plan.rows.map(row => row.code)).toEqual(["R-03", "R-04"]);
    expect(plan.tree?.nodes.slice(-2).map(node => node.order)).toEqual([41, 42]);
    expect(plan.tree?.nodes.find(node => node.id === "other")?.order).toBe(40);
  });
  it("blocca codici esauriti, padre mancante, profondità e limite di nodi", () => {
    const tree = newTree("Prova", "R", "Radice");
    for (let index = 1; index <= 99; index += 1) tree.nodes.push({ ...tree.nodes[0]!, id: `n${index}`, parentId: tree.rootId, code: `R-${String(index).padStart(2, "0")}`, order: index });
    expect(planNodeImport(tree, tree.rootId, "Nuovo", options).rows[0]?.errors[0]).toContain("Nessun codice libero");
    expect(planNodeImport(tree, "missing", "Nuovo", options).tree).toBeUndefined();
    const deep = newTree("Profonda", "R", "Radice");
    for (let index = 0; index < 32; index += 1) deep.nodes.push({ ...deep.nodes[0]!, id: `d${index}`, parentId: deep.nodes.at(-1)!.id, code: `D${index}` });
    expect(planNodeImport(deep, "d31", "Nuovo", options).errors[0]).toContain("Profondità");
    const full = newTree("Piena", "R", "Radice");
    for (let index = 1; index < 5000; index += 1) full.nodes.push({ ...full.nodes[0]!, id: `f${index}`, parentId: full.rootId, code: `F${index}` });
    expect(planNodeImport(full, full.rootId, "Nuovo", options).errors.some(error => error.includes("5000"))).toBe(true);
  });
});

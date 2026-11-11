import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isConfiguratorPath } from "../configurator/model";
import { demoTree } from "./demoTree";
import {
  addChild, canonicalTree, codeIssues, deleteCategory, deleteLeaf, effectiveCategories, inheritFromParent,
  inspectTree, isTreePath, newTree, parseTree, proposeChildCode, setNodeCategories, updateNode, upsertObject,
  type Tree,
} from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";

/** Portati da test-logica.mjs (21 test nodo). Quelli di spostamento, rinumerazione e annulla restano per la PR2. */
const code = (tree: Tree, id: string) => tree.nodes.find(node => node.id === id)!.code;

describe("regole dell'albero nebula-tree v1", () => {
  it("accetta la demo senza errori bloccanti", () => {
    expect(inspectTree(demoTree()).errors).toEqual([]);
  });

  it("modificare le categorie di un inherit lo passa a own e Eredita dal padre lo riallinea", () => {
    const source = demoTree();
    expect(effectiveCategories(source, "n-0701")).toEqual(["c-dim"]);
    const detached = setNodeCategories(source, "n-0701", [...effectiveCategories(source, "n-0701"), "c-avv"]);
    expect(detached.ok && detached.detached).toBe(true);
    if (!detached.ok) return;
    const node = detached.tree.nodes.find(item => item.id === "n-0701")!;
    expect(node.categoryMode).toBe("own");
    expect(node.categoryIds).toEqual(["c-dim", "c-avv"]);
    const restored = inheritFromParent(detached.tree, "n-0701");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const back = restored.tree.nodes.find(item => item.id === "n-0701")!;
    expect(back.categoryMode).toBe("inherit");
    expect(back.categoryIds).toEqual([]);
    expect(effectiveCategories(restored.tree, "n-0701")).toEqual(["c-dim"]);
  });

  it("propaga il cambio del padre ai discendenti inherit fino al primo own", () => {
    const changed = setNodeCategories(demoTree(), "n-07", ["c-avv"]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(effectiveCategories(changed.tree, "n-0701")).toEqual(["c-avv"]);
    expect(effectiveCategories(changed.tree, "n-0702")).toEqual(["c-avv"]);
  });

  it("blocca due sigle P nello stesso nodo, propria e acquisita, anche con spazi e maiuscole", () => {
    const source = demoTree();
    const rejected = upsertObject(source, "n-0803", { type: "characteristic", kind: "acquired", code: " p ", description: "Altra" });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error).toContain("già usata");
    const bad = structuredClone(source);
    bad.nodes.find(node => node.id === "n-0803")!.objects.push({ id: "x", type: "characteristic", order: 9, kind: "acquired", code: "p", description: "dup" });
    expect(inspectTree(bad).errors.some(issue => issue.message.includes("duplicata"))).toBe(true);
    expect(() => parseTree(serializeTree(bad))).toThrow(/duplicata/);
    expect(upsertObject(source, "n-0802", { type: "characteristic", kind: "own", code: "P", description: "ok in altro nodo" }).ok).toBe(true);
  });

  it("accoda un figlio sotto FL-07 con codice FL-0703 e modalità inherit", () => {
    const result = addChild(demoTree(), "n-07");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node.code).toBe("FL-0703");
    expect(result.node.categoryMode).toBe("inherit");
    const children = result.tree.nodes.filter(node => node.parentId === "n-07").sort((a, b) => a.order - b.order);
    expect(children.at(-1)?.id).toBe(result.node.id);
  });

  it("propone FL-02 come prima coppia libera sotto la radice", () => {
    expect(addChild(demoTree(), "n-root").ok && (addChild(demoTree(), "n-root") as { node: { code: string } }).node.code).toBe("FL-02");
  });

  it("salta i codici già usati nel file quando propone un figlio", () => {
    expect(proposeChildCode(demoTree(), "n-09")).toBe("FL-0908");
  });

  it("rifiuta un ulteriore figlio quando le coppie 01-99 sono esaurite", () => {
    let tree = newTree("t", "A", "A");
    for (let index = 0; index < 99; index += 1) {
      const result = addChild(tree, tree.rootId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      tree = result.tree;
    }
    const blocked = addChild(tree, tree.rootId);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toContain("Nessun codice libero");
  });

  it("avvisa se il codice è fuori prefisso e blocca il duplicato", () => {
    const source = demoTree();
    const warning = codeIssues(source, "n-0701", "TF-0703");
    expect(warning.errors).toEqual([]);
    expect(warning.warnings).toHaveLength(1);
    expect(updateNode(source, "n-0701", { code: "fl-0702" }).ok).toBe(false);
    const renamed = updateNode(source, "n-0701", { code: "TF-0703" });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(inspectTree(renamed.tree).warnings.some(issue => issue.nodeId === "n-0701")).toBe(true);
    expect(inspectTree(renamed.tree).errors).toEqual([]);
  });

  it("elimina solo le foglie", () => {
    const source = demoTree();
    expect(deleteLeaf(source, "n-08").ok).toBe(false);
    expect(deleteLeaf(source, "n-root").ok).toBe(false);
    const removed = deleteLeaf(source, "n-0702");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.tree.nodes).toHaveLength(source.nodes.length - 1);
    expect(deleteLeaf(source, "n-08").ok === false && (deleteLeaf(source, "n-08") as { error: string }).error).toMatch(/figli/);
  });

  it("chiede una sostituzione per eliminare una categoria usata e aggiorna chi eredita", () => {
    const source = demoTree();
    expect(deleteCategory(source, "c-dim").ok).toBe(false);
    const replaced = deleteCategory(source, "c-dim", "c-tes");
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.tree.nodes.find(node => node.id === "n-07")!.categoryIds).toEqual(["c-tes"]);
    expect(effectiveCategories(replaced.tree, "n-0701")).toEqual(["c-tes"]);
    expect(replaced.tree.nodes.find(node => node.id === "n-08")!.categoryIds).toEqual(["c-tes", "c-ins"]);
    const removed = deleteCategory(source, "c-avv", null);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.tree.nodes.find(node => node.id === "n-0803")!.categoryIds).toEqual(["c-dim", "c-ins"]);
  });

  it("fa il round-trip parseTree(serializeTree(x)) senza perdere il contenuto", () => {
    const source = demoTree();
    const text = serializeTree(source);
    const parsed = JSON.parse(text) as Tree;
    expect(parsed.format).toBe("nebula-tree");
    expect(parsed.version).toBe(1);
    const loaded = parseTree(text);
    expect(serializeTree(loaded)).toBe(text);
    expect(loaded).toEqual(canonicalTree(source));
    expect(serializeTreeFile(source).endsWith("\n")).toBe(true);
    expect(parseTree(serializeTreeFile(source))).toEqual(loaded);
  });

  it("rifiuta cicli, orfani, formato errato e JSON illeggibile", () => {
    const broken = structuredClone(demoTree());
    broken.nodes.find(node => node.id === "n-07")!.parentId = "n-0701";
    expect(() => parseTree(JSON.stringify(broken))).toThrow(/Ciclo|orfano|radice/);
    expect(() => parseTree('{"format":"x"}')).toThrow();
    expect(() => parseTree("{not json")).toThrow(/JSON non valido/);
  });

  it("il campione del Vault coincide con l'albero dimostrativo", () => {
    const file = join(process.cwd(), "src/features/trees/tendaFinestra.tree.json");
    if (process.env.WRITE_TREE === "1") writeFileSync(file, serializeTreeFile(demoTree()));
    expect(readFileSync(file, "utf8")).toBe(serializeTreeFile(demoTree()));
  });

  it("non confonde i file dei configuratori con le strutture", () => {
    expect(isTreePath("Configurators/Pergola.config.json")).toBe(false);
    expect(isConfiguratorPath("Strutture/FL.tree.json")).toBe(false);
    expect(isTreePath("Strutture/FL.tree.json")).toBe(true);
    expect(code(demoTree(), "n-07")).toBe("FL-07");
  });
});

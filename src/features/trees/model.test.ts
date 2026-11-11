import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isConfiguratorPath } from "../configurator/model";
import { demoTree } from "./demoTree";
import {
  addChild, canonicalTree, childrenOf, codeIssues, deleteCategory, deleteLeaf, dropDestination, effectiveCategories,
  inheritFromParent, inspectTree, isTreePath, newTree, parseTree, planMove, principalCategory, proposeChildCode,
  reorderSibling, setNodeCategories, updateCategory, updateNode, upsertObject, type Tree,
} from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";

/** Portati da test-logica.mjs. I criteri 6 e 8 restano qui come regressione; lo spostamento è nella sezione sotto. */
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
    const parent = tree.nodes.find(node => node.parentId === tree.rootId)!;
    const nested = addChild(tree, parent.id);
    expect(nested.ok).toBe(true);
    if (!nested.ok) return;
    const leaf = nested.tree.nodes.find(node => node.parentId === parent.id)!;
    const moved = planMove(nested.tree, leaf.id, nested.tree.rootId);
    expect(moved.ok).toBe(false);
    expect(moved.tree).toBeNull();
    expect(moved.errors[0]).toContain("Nessun codice libero");
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

  it("sposta FL-07 sotto FL-12 e rinumera il nodo e i figli conformi", () => {
    const source = demoTree();
    const plan = planMove(source, "n-07", "n-12");
    expect(plan.ok).toBe(true);
    expect(plan.tree).not.toBeNull();
    expect(code(plan.tree!, "n-07")).toBe("FL-1201");
    expect(code(plan.tree!, "n-0701")).toBe("FL-120101");
    expect(code(plan.tree!, "n-0702")).toBe("FL-120102");
    expect(plan.renames).toHaveLength(3);
    expect(code(source, "n-07")).toBe("FL-07");
    expect(source.nodes.find(node => node.id === "n-07")!.parentId).toBe("n-root");
  });

  it("lascia invariato un codice libero e i suoi discendenti, con avviso fuori prefisso", () => {
    const plan = planMove(demoTree(), "n-x1", "n-12");
    expect(plan.ok).toBe(true);
    expect(code(plan.tree!, "n-x1")).toBe("X-1");
    expect(code(plan.tree!, "n-x1a")).toBe("X-101");
    expect(plan.renames).toHaveLength(0);
    expect(plan.warnings.some(warning => warning.includes("fuori prefisso"))).toBe(true);
    expect(inspectTree(plan.tree!).warnings.some(issue => issue.nodeId === "n-x1")).toBe(true);
  });

  it("blocca lo spostamento se il nuovo codice coincide con uno già nel file", () => {
    const source = demoTree();
    const plan = planMove(source, "n-0804", "n-09");
    expect(plan.ok).toBe(false);
    expect(plan.tree).toBeNull();
    expect(plan.errors.some(error => error.includes("FL-0907") && error.includes("FL-19"))).toBe(true);
    expect(code(source, "n-0804")).toBe("FL-0804");
  });

  it("riordinare nello stesso padre non cambia nessun codice", () => {
    const source = demoTree();
    const plan = planMove(source, "n-0803", "n-08", 0);
    expect(plan.ok && plan.sameParent).toBe(true);
    expect(plan.renames).toHaveLength(0);
    expect(plan.tree!.nodes.map(node => node.code)).toEqual(source.nodes.map(node => node.code));
    expect(childrenOf(plan.tree!, "n-08")[0]?.id).toBe("n-0803");
    const down = reorderSibling(source, "n-04", 1);
    expect(down?.ok && down.sameParent).toBe(true);
    expect(down?.renames).toHaveLength(0);
    const order = childrenOf(down!.tree!, "n-root").map(node => node.id);
    expect(order.indexOf("n-04")).toBe(order.indexOf("n-47") + 1);
    expect(code(down!.tree!, "n-04")).toBe("FL-04");
    expect(dropDestination(source, "n-07", "n-12", "inside")).toEqual({ parentId: "n-12", index: null });
    const withoutDragged = childrenOf(source, "n-root").filter(node => node.id !== "n-04");
    expect(dropDestination(source, "n-04", "n-47", "before")).toEqual({ parentId: "n-root", index: withoutDragged.findIndex(node => node.id === "n-47") });
  });

  it("un inherit spostato prende subito le categorie del nuovo padre, un own le tiene", () => {
    const colored = updateCategory(demoTree(), "c-mot", { color: "#e5534b" });
    expect(colored.ok).toBe(true);
    if (!colored.ok) return;
    const inherited = planMove(colored.tree, "n-0801", "n-12");
    expect(inherited.ok).toBe(true);
    expect(effectiveCategories(inherited.tree!, "n-0801")).toEqual(["c-mot"]);
    expect(inherited.catChanged).toEqual(["n-0801"]);
    expect(principalCategory(inherited.tree!, "n-0801")?.color).toBe("#e5534b");
    expect(inherited.tree!.nodes.find(node => node.id === "n-0801")!.categoryMode).toBe("inherit");
    const own = planMove(colored.tree, "n-0803", "n-12");
    expect(own.ok).toBe(true);
    expect(effectiveCategories(own.tree!, "n-0803")).toEqual(["c-dim", "c-ins", "c-avv"]);
    expect(own.catChanged).toHaveLength(0);
    expect(own.tree!.nodes.find(node => node.id === "n-0803")!.categoryMode).toBe("own");
    expect(principalCategory(own.tree!, "n-0803")?.color).toBe("#22d3ee");
  });

  it("lo snapshot precedente allo spostamento resta identico e distinto dal risultato", () => {
    const source = demoTree();
    const snapshot = serializeTree(source);
    const plan = planMove(source, "n-07", "n-12");
    expect(plan.ok).toBe(true);
    expect(serializeTree(plan.tree!)).not.toBe(snapshot);
    expect(serializeTree(source)).toBe(snapshot);
  });

  it("vieta di spostare la radice o un nodo dentro se stesso o un discendente", () => {
    const source = demoTree();
    expect(planMove(source, "n-08", "n-0803").ok).toBe(false);
    expect(planMove(source, "n-08", "n-0803").errors[0]).toMatch(/discendente/);
    expect(planMove(source, "n-08", "n-08").ok).toBe(false);
    expect(planMove(source, "n-root", "n-07").ok).toBe(false);
    expect(planMove(source, "n-root", "n-07").errors[0]).toMatch(/radice/);
  });

  it("un discendente con codice libero interrompe la catena di rinumerazione", () => {
    const first = addChild(demoTree(), "n-0701", { code: "ZZ", name: "libero" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const freeNode = first.tree.nodes.find(node => node.code === "ZZ")!;
    const second = addChild(first.tree, freeNode.id, { code: "ZZ01", name: "sotto libero" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const plan = planMove(second.tree, "n-07", "n-12");
    expect(plan.ok).toBe(true);
    expect(code(plan.tree!, "n-07")).toBe("FL-1201");
    expect(code(plan.tree!, "n-0701")).toBe("FL-120101");
    expect(plan.tree!.nodes.find(node => node.id === freeNode.id)!.code).toBe("ZZ");
    expect(plan.tree!.nodes.some(node => node.code === "ZZ01")).toBe(true);
  });
});

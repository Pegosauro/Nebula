import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isConfiguratorPath } from "../configurator/model";
import { demoTree } from "./demoTree";
import {
  addChild, addSibling, canonicalTree, childrenOf, codeIssues, deleteCategory, deleteConfirmText, deleteNode, descendantCount, dropDestination, effectiveCategory,
  inheritFromParent, inspectTree, isTreePath, newTree, parseTree, planMove, principalCategory, proposeChildCode,
  reorderSibling, setNodeCategory, setNodesCategory, updateCategory, updateNode, upsertObject, type Tree,
} from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";

/** Portati da test-logica.mjs. I criteri 6 e 8 restano qui come regressione; lo spostamento è nella sezione sotto. */
const code = (tree: Tree, id: string) => tree.nodes.find(node => node.id === id)!.code;

describe("regole dell'albero nebula-tree v1", () => {
  it("accetta la demo senza errori bloccanti", () => {
    expect(inspectTree(demoTree()).errors).toEqual([]);
  });

  it("cambia categorie in blocco con discendenti opzionali senza toccare gli altri nodi", () => {
    const source = parseTree(JSON.stringify(demoTree()));
    const before = serializeTree(source);
    const direct = setNodesCategory(source, ["n-07", "n-0701"], "c-avv");
    if (!direct.ok) throw new Error(direct.error);
    expect(effectiveCategory(direct.tree, "n-07")).toBe("c-avv");
    expect(effectiveCategory(direct.tree, "n-0701")).toBe("c-avv");
    expect(effectiveCategory(direct.tree, "n-0702")).toBe("c-dim");
    const branch = setNodesCategory(source, ["n-07", "n-0701", "n-07"], null, true);
    if (!branch.ok) throw new Error(branch.error);
    for (const id of ["n-07", "n-0701", "n-0702"]) expect(effectiveCategory(branch.tree, id)).toBeNull();
    expect(effectiveCategory(branch.tree, "n-08")).toBe("c-dim");
    expect(serializeTree(source)).toBe(before);
    expect(branch.tree.nodes.map(node => [node.id, node.code, node.order])).toEqual(source.nodes.map(node => [node.id, node.code, node.order]));
    expect(setNodesCategory(source, ["n-07", "missing"], "c-avv").ok).toBe(false);
    expect(setNodesCategory(source, ["n-07"], "missing").ok).toBe(false);
  });

  it("salva e rilegge insieme grassetto, corsivo, sottolineato e barrato", () => {
    const source = demoTree();
    const changed = updateCategory(source, "c-dim", { textStyle: { bold: true, italic: true, underline: true, strike: true } });
    if (!changed.ok) throw new Error(changed.error);
    const loaded = parseTree(serializeTreeFile(changed.tree));
    expect(loaded.categories.find(category => category.id === "c-dim")?.textStyle).toEqual({ bold: true, italic: true, underline: true, strike: true });
    expect(source.categories.find(category => category.id === "c-dim")?.textStyle).toBeUndefined();
    const cleared = updateCategory(loaded, "c-dim", { textStyle: { bold: false } });
    if (!cleared.ok) throw new Error(cleared.error);
    expect(parseTree(serializeTreeFile(cleared.tree)).categories.find(category => category.id === "c-dim")?.textStyle).toBeUndefined();
  });

  it("modificare la categoria di un inherit lo passa a own e inheritFromParent lo riallinea", () => {
    const source = demoTree();
    expect(effectiveCategory(source, "n-0701")).toBe("c-dim");
    const same = setNodeCategory(source, "n-0701", "c-dim");
    expect(same.ok && same.detached).toBe(true);
    if (!same.ok) return;
    expect(same.tree.nodes.find(item => item.id === "n-0701")!.categoryMode).toBe("own");
    const detached = setNodeCategory(source, "n-0701", "c-avv");
    expect(detached.ok && detached.detached).toBe(true);
    if (!detached.ok) return;
    const node = detached.tree.nodes.find(item => item.id === "n-0701")!;
    expect(node.categoryMode).toBe("own");
    expect(node.categoryId).toBe("c-avv");
    const cleared = setNodeCategory(detached.tree, "n-0701", null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.tree.nodes.find(item => item.id === "n-0701")!.categoryId).toBeNull();
    expect(effectiveCategory(cleared.tree, "n-0701")).toBeNull();
    const restored = inheritFromParent(detached.tree, "n-0701");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const back = restored.tree.nodes.find(item => item.id === "n-0701")!;
    expect(back.categoryMode).toBe("inherit");
    expect(back.categoryId).toBeNull();
    expect(effectiveCategory(restored.tree, "n-0701")).toBe("c-dim");
    expect(inheritFromParent(source, "n-root").ok).toBe(false);
  });

  it("cambiare categoria al padre conserva quelle dei discendenti anche nei file precedenti", () => {
    const changed = setNodeCategory(demoTree(), "n-07", "c-avv");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(effectiveCategory(changed.tree, "n-0701")).toBe("c-dim");
    expect(effectiveCategory(changed.tree, "n-0702")).toBe("c-dim");
  });

  it("conserva tutte le categorie visibili dei vecchi file e rende indipendenti padre, figli e nipoti", () => {
    const legacy = demoTree();
    const loaded = parseTree(JSON.stringify(legacy));
    for (const node of legacy.nodes) {
      expect(effectiveCategory(loaded, node.id)).toBe(effectiveCategory(legacy, node.id));
      expect(loaded.nodes.find(item => item.id === node.id)!.categoryMode).toBe("own");
    }
    const snapshot = JSON.stringify(loaded);
    const changed = setNodeCategory(loaded, "n-10", null);
    if (!changed.ok) throw new Error(changed.error);
    expect(effectiveCategory(changed.tree, "n-10")).toBeNull();
    expect(effectiveCategory(changed.tree, "n-x1")).toBe("c-tes");
    expect(effectiveCategory(changed.tree, "n-x1a")).toBe("c-tes");
    const child = setNodeCategory(changed.tree, "n-x1", "c-avv");
    if (!child.ok) throw new Error(child.error);
    expect(effectiveCategory(child.tree, "n-10")).toBeNull();
    expect(effectiveCategory(child.tree, "n-x1a")).toBe("c-tes");
    expect(JSON.stringify(loaded)).toBe(snapshot);
    const reopened = parseTree(serializeTreeFile(child.tree));
    expect(reopened).toEqual(canonicalTree(child.tree));
    const moved = planMove(reopened, "n-x1", "n-12");
    expect(moved.ok).toBe(true);
    expect(effectiveCategory(moved.tree!, "n-x1")).toBe("c-avv");
    expect(effectiveCategory(moved.tree!, "n-x1a")).toBe("c-tes");
    expect(moved.catChanged).toEqual([]);
  });

  it("in lettura tiene solo la prima categoria e tratta l'elenco vuoto come nessuna", () => {
    const raw = JSON.parse(serializeTree(demoTree())) as { nodes: Array<Record<string, unknown>> };
    const rewrite = (id: string, categoryIds: string[]) => {
      const node = raw.nodes.find(item => item.id === id)!;
      delete node.categoryId;
      node.categoryIds = categoryIds;
    };
    rewrite("n-08", ["c-ins", "c-avv", "c-dim"]);
    rewrite("n-44", []);
    rewrite("n-47", ["", "c-mot"]);
    const child = raw.nodes.find(item => item.id === "n-0701")!;
    delete child.categoryId;
    child.categoryMode = "inherit";
    child.categoryIds = ["c-avv"];
    const loaded = parseTree(JSON.stringify(raw));
    expect(loaded.nodes.find(node => node.id === "n-08")!.categoryId).toBe("c-ins");
    expect(loaded.nodes.find(node => node.id === "n-44")!.categoryId).toBeNull();
    expect(loaded.nodes.find(node => node.id === "n-47")!.categoryId).toBe("c-mot");
    expect(loaded.nodes.find(node => node.id === "n-0701")!.categoryId).toBe("c-dim");
    expect(effectiveCategory(loaded, "n-0701")).toBe("c-dim");
    expect(serializeTree(loaded)).not.toContain("categoryIds");
    expect(JSON.parse(serializeTree(loaded)).nodes.find((node: { id: string }) => node.id === "n-08").categoryId).toBe("c-ins");
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

  it("accoda un figlio sotto FL-07 con codice FL-0703 e categoria indipendente", () => {
    const result = addChild(demoTree(), "n-07");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node.code).toBe("FL-0703");
    expect(result.node.categoryMode).toBe("own");
    const children = result.tree.nodes.filter(node => node.parentId === "n-07").sort((a, b) => a.order - b.order);
    expect(children.at(-1)?.id).toBe(result.node.id);
  });

  it("inserisce un fratello subito dopo, propone la prima coppia libera e non cambia i codici", () => {
    const source = demoTree();
    const snapshot = serializeTree(source);
    const before = childrenOf(source, "n-07").map(node => ({ id: node.id, order: node.order, code: node.code }));
    const rootBefore = childrenOf(source, "n-root").map(node => ({ id: node.id, order: node.order, code: node.code }));
    const result = addSibling(source, "n-0701");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(serializeTree(source)).toBe(snapshot);
    expect(result.node.code).toBe("FL-0703");
    expect(result.node.name).toBe("Nuovo nodo");
    expect(result.node.parentId).toBe("n-07");
    expect(result.node.categoryMode).toBe("own");
    expect(result.node.categoryId).toBeNull();
    expect(effectiveCategory(result.tree, result.node.id)).toBeNull();
    const children = childrenOf(result.tree, "n-07");
    expect(children.map(node => node.id)).toEqual([before[0]!.id, result.node.id, before[1]!.id]);
    expect(children.map(node => node.order)).toEqual([before[0]!.order, before[0]!.order + 1, before[1]!.order + 1]);
    expect(children.map(node => node.code)).toEqual([before[0]!.code, "FL-0703", before[1]!.code]);
    expect(childrenOf(result.tree, "n-root").map(node => node.code)).toEqual(rootBefore.map(node => node.code));
    const shifted = addSibling(source, "n-04");
    expect(shifted.ok).toBe(true);
    if (!shifted.ok) return;
    expect(shifted.node.code).toBe("FL-02");
    const root = childrenOf(shifted.tree, "n-root");
    const at = rootBefore.findIndex(node => node.id === "n-04");
    expect(root.map(node => node.id).slice(at, at + 3)).toEqual([rootBefore[at]!.id, shifted.node.id, rootBefore[at + 1]!.id]);
    expect(root.find(node => node.id === "n-47")!.order).toBe(rootBefore.find(node => node.id === "n-47")!.order + 1);
    expect(root.find(node => node.id === "n-47")!.code).toBe("FL-47");
    expect(root.find(node => node.id === "n-04")!.code).toBe("FL-04");
    const skipped = addSibling(source, "n-0901");
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.node.code).toBe("FL-0908");
    const blocked = addSibling(source, "n-root");
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toMatch(/radice/);
    let narrow = newTree("t", "A", "A");
    narrow = { ...narrow, codeStep: 1 };
    for (let index = 0; index < 9; index += 1) {
      const added = addChild(narrow, narrow.rootId);
      expect(added.ok).toBe(true);
      if (!added.ok) return;
      narrow = added.tree;
    }
    const first = childrenOf(narrow, narrow.rootId)[0]!;
    const full = addSibling(narrow, first.id);
    expect(full.ok).toBe(false);
    if (full.ok) return;
    expect(full.error).toContain("Nessun codice libero");
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

  it("elimina un nodo insieme ai discendenti e lascia la radice", () => {
    const source = demoTree();
    const root = deleteNode(source, "n-root");
    expect(root.ok).toBe(false);
    if (root.ok) return;
    expect(root.error).toMatch(/radice/);
    expect(descendantCount(source, "n-08")).toBe(4);
    expect(deleteConfirmText("FL-12", 5)).toBe("Eliminare FL-12 e 5 nodi discendenti? Verranno eliminati 6 nodi.");
    expect(deleteConfirmText("FL-08", descendantCount(source, "n-08"))).toBe("Eliminare FL-08 e 4 nodi discendenti? Verranno eliminati 5 nodi.");
    expect(deleteConfirmText("FL-0702", 0)).toBe("Eliminare FL-0702? Verrà eliminato 1 nodo.");
    const before = childrenOf(source, "n-root").map(node => node.id);
    const removed = deleteNode(source, "n-08");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.removed).toBe(5);
    expect(removed.tree.nodes).toHaveLength(source.nodes.length - 5);
    expect(removed.tree.nodes.some(node => node.id === "n-0803" || node.id === "n-08")).toBe(false);
    expect(childrenOf(removed.tree, "n-root").map(node => node.id)).toEqual(before.filter(id => id !== "n-08"));
    expect(childrenOf(removed.tree, "n-root").map(node => node.order)).toEqual(childrenOf(removed.tree, "n-root").map((_, index) => index));
    expect(removed.tree.nodes.find(node => node.id === "n-07")!.code).toBe("FL-07");
    const leaf = deleteNode(source, "n-0702");
    expect(leaf.ok).toBe(true);
    if (!leaf.ok) return;
    expect(leaf.removed).toBe(1);
  });

  it("chiede una sostituzione per eliminare una categoria usata e aggiorna chi eredita", () => {
    const source = demoTree();
    expect(deleteCategory(source, "c-dim").ok).toBe(false);
    const replaced = deleteCategory(source, "c-dim", "c-tes");
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.tree.nodes.find(node => node.id === "n-07")!.categoryId).toBe("c-tes");
    expect(effectiveCategory(replaced.tree, "n-0701")).toBe("c-tes");
    expect(replaced.tree.nodes.find(node => node.id === "n-08")!.categoryId).toBe("c-tes");
    expect(replaced.tree.nodes.find(node => node.id === "n-0803")!.categoryId).toBe("c-tes");
    const removed = deleteCategory(source, "c-avv", null);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.tree.nodes.find(node => node.id === "n-47")!.categoryId).toBeNull();
    expect(removed.tree.nodes.find(node => node.id === "n-0803")!.categoryId).toBe("c-dim");
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
    expect(serializeTreeFile(parseTree(readFileSync(file, "utf8")))).toBe(serializeTreeFile(demoTree()));
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
    expect(effectiveCategory(inherited.tree!, "n-0801")).toBe("c-mot");
    expect(inherited.catChanged).toEqual(["n-0801"]);
    expect(principalCategory(inherited.tree!, "n-0801")?.color).toBe("#e5534b");
    expect(inherited.tree!.nodes.find(node => node.id === "n-0801")!.categoryMode).toBe("inherit");
    expect(inherited.tree!.nodes.find(node => node.id === "n-0801")!.categoryId).toBeNull();
    const own = planMove(colored.tree, "n-0803", "n-12");
    expect(own.ok).toBe(true);
    expect(effectiveCategory(own.tree!, "n-0803")).toBe("c-dim");
    expect(own.catChanged).toHaveLength(0);
    expect(own.tree!.nodes.find(node => node.id === "n-0803")!.categoryMode).toBe("own");
    expect(own.tree!.nodes.find(node => node.id === "n-0803")!.categoryId).toBe("c-dim");
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

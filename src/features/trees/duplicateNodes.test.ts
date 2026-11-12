import { describe, expect, it } from "vitest";
import { demoTree } from "./demoTree";
import { planDuplicate } from "./duplicateNodes";
import { MAX_DEPTH, MAX_NODES, childrenOf, effectiveCategory, inspectTree, newTree, normCode, parseTree, type Tree } from "./model";
import { serializeTreeFile } from "./serializeTree";

describe("duplicazione di nodi e rami", () => {
  it("copia solo il nodo con nota, categorie e oggetti indipendenti e nuovi identificativi", () => {
    const source = demoTree(), before = serializeTreeFile(source);
    const original = source.nodes.find(node => node.id === "n-0803")!;
    const plan = planDuplicate(source, original.id, "n-08", false);
    expect(plan.errors).toEqual([]); expect(plan.rows).toHaveLength(1);
    const copy = plan.tree!.nodes.find(node => node.id === plan.copyId)!;
    expect(copy.code).toBe("FL-0805"); expect(copy.name).toBe(original.name); expect(copy.note).toBe(original.note);
    expect(copy.categoryMode).toBe("own"); expect(copy.categoryId).toBe(effectiveCategory(source, original.id));
    expect(copy.objects.map(({ id: _, ...object }) => object)).toEqual(original.objects.map(({ id: _, ...object }) => object));
    expect(copy.objects.every(object => original.objects.every(item => item.id !== object.id))).toBe(true);
    copy.note = "Nota della copia";
    if (copy.objects[0]?.type === "characteristic") copy.objects[0].description = "Modificata solo nella copia";
    expect(serializeTreeFile(source)).toBe(before);
    expect(plan.tree!.nodes.find(node => node.id === original.id)).toEqual(original);
    expect(inspectTree(plan.tree!).errors).toEqual([]);
  });

  it("duplica l'intero ramo dopo l'originale, conserva l'ordine e mostra tutti i codici prima di applicare", () => {
    const tree = demoTree(), before = serializeTreeFile(tree);
    const plan = planDuplicate(tree, "n-08", tree.rootId, true);
    expect(plan.rows.map(row => [row.oldCode, row.code])).toEqual([
      ["FL-08", "FL-02"], ["FL-0801", "FL-0201"], ["FL-0804", "FL-0204"], ["FL-0802", "FL-0202"], ["FL-0803", "FL-0203"],
    ]);
    expect(serializeTreeFile(tree)).toBe(before);
    const next = plan.tree!;
    const siblings = childrenOf(next, tree.rootId).map(node => node.id);
    expect(siblings.indexOf(plan.copyId!)).toBe(siblings.indexOf("n-08") + 1);
    for (const row of plan.rows.slice(1)) expect(next.nodes.find(node => node.id === row.id)!.parentId).toBe(plan.copyId);
    for (const row of plan.rows) {
      const original = tree.nodes.find(node => node.id === row.sourceId)!;
      const copy = next.nodes.find(node => node.id === row.id)!;
      expect(copy.categoryId).toBe(effectiveCategory(tree, original.id));
      expect(copy.note).toBe(original.note);
    }
    expect(inspectTree(next).errors).toEqual([]);
    expect(parseTree(serializeTreeFile(next)).nodes).toHaveLength(tree.nodes.length + 5);
    expect(next.nodes.filter(node => !plan.rows.some(row => row.id === node.id)).map(node => node.code)).toEqual(tree.nodes.map(node => node.code));
  });

  it("evita anche collisioni globali con codici liberi, maiuscole e spazi diversi", () => {
    const tree = demoTree();
    tree.nodes.push({ ...tree.nodes[1]!, id: "collision", code: " fl-0201 ", order: 100 });
    const plan = planDuplicate(tree, "n-08", tree.rootId, true);
    expect(plan.tree).toBeDefined();
    expect(plan.rows.find(row => row.oldCode === "FL-0801")!.code).toBe("FL-0202");
    expect(new Set(plan.tree!.nodes.map(node => normCode(node.code))).size).toBe(plan.tree!.nodes.length);
    expect(inspectTree(plan.tree!).errors).toEqual([]);
  });

  it("può copiare sotto un proprio discendente e duplicare la radice senza includere ricorsivamente le copie", () => {
    const tree = demoTree();
    const branch = planDuplicate(tree, "n-08", "n-0803", true);
    expect(branch.rows).toHaveLength(5); expect(inspectTree(branch.tree!).errors).toEqual([]);
    const root = planDuplicate(tree, tree.rootId, tree.rootId, true);
    expect(root.rows).toHaveLength(tree.nodes.length);
    expect(root.tree!.nodes.filter(node => node.parentId === null)).toHaveLength(1);
    expect(inspectTree(root.tree!).errors).toEqual([]);
  });

  it("rinumera codici liberi e rispetta separatore e numero di cifre configurati", () => {
    const tree = newTree("Prova", "R", "Radice"); tree.codeSeparator = ":"; tree.codeStep = 3;
    const node = { ...tree.nodes[0]!, id: "source", parentId: tree.rootId, code: "R:010", order: 0 };
    tree.nodes.push(node, { ...node, id: "child", parentId: node.id, code: "R:010017", order: 0 }, { ...node, id: "free", parentId: node.id, code: "LIBERO", order: 1 });
    const plan = planDuplicate(tree, node.id, tree.rootId, true);
    expect(plan.rows.map(row => row.code)).toEqual(["R:001", "R:001017", "R:001001"]);
    expect(inspectTree(plan.tree!).errors).toEqual([]);
  });

  it("blocca l'intera copia se mancano codici liberi, un nodo o la destinazione", () => {
    const tree = newTree("Prova", "R", "Radice"); tree.codeStep = 1;
    for (let index = 1; index <= 9; index++) tree.nodes.push({ ...tree.nodes[0]!, id: `n${index}`, parentId: tree.rootId, code: `R-${index}`, order: index });
    const before = serializeTreeFile(tree);
    for (const plan of [planDuplicate(tree, "n1", tree.rootId, false), planDuplicate(tree, "missing", tree.rootId, false), planDuplicate(tree, "n1", "missing", false)]) {
      expect(plan.tree).toBeUndefined(); expect(plan.rows).toEqual([]); expect(plan.errors.length).toBeGreaterThan(0);
    }
    expect(serializeTreeFile(tree)).toBe(before);
    const branch = newTree("Prova", "R", "Radice"); branch.codeStep = 1;
    branch.nodes.push({ ...branch.nodes[0]!, id: "branch", parentId: branch.rootId, code: "R-1", order: 0 });
    for (let index = 0; index < 10; index++) branch.nodes.push({ ...branch.nodes[0]!, id: `free${index}`, parentId: "branch", code: `LIBERO${index}`, order: index });
    const branchBefore = serializeTreeFile(branch);
    const unavailable = planDuplicate(branch, "branch", branch.rootId, true);
    expect(unavailable.tree).toBeUndefined(); expect(unavailable.rows).toEqual([]);
    expect(serializeTreeFile(branch)).toBe(branchBefore);
    const crowded = demoTree(); crowded.nodes = Array.from({ length: MAX_NODES }, (_, index) => ({ ...crowded.nodes[0]!, id: `n${index}`, code: `N${index}` }));
    expect(planDuplicate(crowded, "n1", "n0", false).errors[0]).toContain(`${MAX_NODES}`);
    const deep: Tree = newTree("Prova", "R", "Radice");
    for (let index = 1; index <= MAX_DEPTH; index++) deep.nodes.push({ ...deep.nodes[0]!, id: `d${index}`, parentId: index === 1 ? deep.rootId : `d${index - 1}`, code: `D${index}` });
    expect(planDuplicate(deep, deep.rootId, `d${MAX_DEPTH}`, false).errors[0]).toContain("profondità massima");
  });
});

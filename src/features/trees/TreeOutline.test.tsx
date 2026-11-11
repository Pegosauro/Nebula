import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TreeOutline } from "./TreeOutline";
import { newTree } from "./model";
import { ROW_HEIGHT, type OutlineRow } from "./outline";

it("virtualizza seguendo lo scorrimento dell'area albero e raggiunge le ultime righe", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const tree = newTree("Molti nodi", "R", "Radice");
  for (let index = 1; index <= 1200; index += 1) tree.nodes.push({ ...tree.nodes[0]!, id: `n${index}`, parentId: tree.rootId, code: `R-${index}`, name: `Nodo ${index}`, order: index });
  const rows: OutlineRow[] = tree.nodes.map(node => ({ kind: "node", id: node.id, depth: node.parentId ? 2 : 1, hasChildren: node.parentId === null, expanded: true, dimmed: false, matched: false }));
  const owner = document.createElement("section");
  owner.className = "tree-main";
  Object.defineProperty(owner, "clientHeight", { value: 600 });
  document.body.append(owner);
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { ...original.call(this), top: this.classList.contains("tree-scroll") ? 200 - owner.scrollTop : 0 };
  });
  const root = createRoot(owner);
  const noop = vi.fn();
  try {
    await act(async () => root.render(<TreeOutline tree={tree} rows={rows} selectedId={tree.rootId} query="" renaming={null} adding={null} renamedIds={new Set()} onSelect={noop} onToggle={noop} onStartEdit={noop} onSelectObject={noop} onRenameChange={noop} onAddChange={noop} onMoveAttempt={noop} onRequestMove={noop} onContextMenu={noop} onInlineBlur={noop} holdInlineBlur={noop} />));
    expect(owner.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50);
    expect(owner.textContent).not.toContain("Nodo 1200");
    await act(async () => {
      owner.scrollTop = 200 + 1190 * ROW_HEIGHT;
      owner.dispatchEvent(new Event("scroll"));
    });
    expect(owner.querySelector('[data-node-id="n1200"]')).not.toBeNull();
    expect(owner.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50);
  } finally {
    await act(async () => root.unmount());
    owner.remove();
    vi.restoreAllMocks();
  }
});

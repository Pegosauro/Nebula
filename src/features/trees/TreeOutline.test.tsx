import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TreeOutline } from "./TreeOutline";
import { newTree } from "./model";
import { ROW_HEIGHT, type OutlineRow } from "./outline";

it("virtualizza e raggiunge le ultime righe scorrendo solo il riquadro dei nodi", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const tree = newTree("Molti nodi", "R", "Radice");
  for (let index = 1; index <= 1200; index += 1) tree.nodes.push({ ...tree.nodes[0]!, id: `n${index}`, parentId: tree.rootId, code: `R-${index}`, name: `Nodo ${index}`, order: index });
  const rows: OutlineRow[] = tree.nodes.map(node => ({ kind: "node", id: node.id, depth: node.parentId ? 2 : 1, hasChildren: node.parentId === null, expanded: true, dimmed: false, matched: false }));
  const owner = document.createElement("section");
  owner.className = "tree-main";
  document.body.append(owner);
  const root = createRoot(owner);
  const noop = vi.fn();
  const render = (selectedId: string) => root.render(<TreeOutline tree={tree} rows={rows} selectedId={selectedId} query="" renaming={null} adding={null} renamedIds={new Set()} onSelect={noop} onToggle={noop} onStartEdit={noop} onSelectObject={noop} onRenameChange={noop} onAddChange={noop} onMoveAttempt={noop} onRequestMove={noop} onContextMenu={noop} onInlineBlur={noop} holdInlineBlur={noop} />);
  try {
    await act(async () => render(tree.rootId));
    const scroller = owner.querySelector<HTMLElement>(".tree-scroll")!;
    Object.defineProperty(scroller, "clientHeight", { value: 600 });
    expect(owner.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50);
    expect(owner.textContent).not.toContain("Nodo 1200");
    await act(async () => {
      scroller.scrollTop = 1190 * ROW_HEIGHT;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(owner.querySelector('[data-node-id="n1200"]')).not.toBeNull();
    expect(owner.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50);
    expect(owner.scrollTop).toBe(0);
    await act(async () => render("n600"));
    expect(scroller.scrollTop).toBe(600 * ROW_HEIGHT);
    await act(async () => scroller.dispatchEvent(new Event("scroll")));
    expect(owner.querySelector('[data-node-id="n600"]')).not.toBeNull();
    expect(owner.scrollTop).toBe(0);
  } finally {
    await act(async () => root.unmount());
    owner.remove();
    vi.restoreAllMocks();
  }
});

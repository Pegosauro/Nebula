import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { dirname, isPathInside } from "../../domain/path";
import type { VaultEntry } from "../../domain/vault";
import { dragPreview, scrollAtDragEdge, trackPointerDrag, type DragPoint } from "../../components/ui/pointerDrag";

type Target = { path: string; allowed: boolean };
type Feedback = { source: string; target?: Target; expandedOnHover?: string };

export function useFileTreeDrag(tree: RefObject<HTMLUListElement | null>, entries: VaultEntry[], expanded: Set<string>, expand: (path: string) => void, move?: (entry: VaultEntry, path: string) => Promise<string>) {
  const [feedback, setFeedback] = useState<Feedback>();
  const [landed, setLanded] = useState<string>();
  const pending = useRef(false);
  const cancelDrag = useRef<() => void>(undefined);
  const frame = useRef(0);
  const expandTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const landedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const directories = useMemo(() => {
    const result = new Map<string, VaultEntry[]>([["", entries]]);
    const visit = (items: VaultEntry[]) => {
      for (const item of items) if (item.type === "directory") {
        const children = item.children ?? [];
        result.set(item.path, children);
        visit(children);
      }
    };
    visit(entries);
    return result;
  }, [entries]);
  const current = useRef({ directories, expanded, expand, move });
  current.current = { directories, expanded, expand, move };
  useEffect(() => () => {
    cancelDrag.current?.();
    cancelAnimationFrame(frame.current);
    clearTimeout(expandTimer.current);
    clearTimeout(landedTimer.current);
  }, []);

  function start(entry: VaultEntry, label: string, source: HTMLElement, event: PointerEvent | TouchEvent) {
    if (!current.current.move || pending.current || cancelDrag.current || (entry.type === "file" && entry.extension !== ".md")) return;
    const root = tree.current;
    const scroller = root?.closest<HTMLElement>(".explorer-scroll");
    if (!root || !scroller) return;

    const findTarget = ({ x, y }: DragPoint): Target | undefined => {
      const node = root.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tree-destination]");
      if (!node || !root.contains(node)) return;
      const path = node.dataset.treeDestination!;
      const children = current.current.directories.get(path);
      const allowed = !!children && path !== dirname(entry.path) &&
        (entry.type !== "directory" || !isPathInside(path, entry.path)) &&
        !children.some(child => child.name.localeCompare(entry.name, undefined, { sensitivity: "base" }) === 0);
      return { path, allowed };
    };
    let point: DragPoint, target: Target | undefined, expandedOnHover: string | undefined, preview: ReturnType<typeof dragPreview> | undefined;
    const draw = () => {
      frame.current = 0;
      if (!preview) return;
      preview.move(point);
      const scrolled = scrollAtDragEdge(scroller, point, "y");
      const next = findTarget(point);
      if (next?.path !== target?.path || next?.allowed !== target?.allowed) {
        target = next;
        setFeedback({ source: entry.path, target, expandedOnHover });
        clearTimeout(expandTimer.current);
        if (next?.allowed && next.path && !current.current.expanded.has(next.path)) {
          expandTimer.current = setTimeout(() => {
            expandedOnHover = next.path;
            current.current.expand(next.path);
            setFeedback({ source: entry.path, target, expandedOnHover });
          }, 620);
        }
      }
      if (scrolled) frame.current = requestAnimationFrame(draw);
    };
    cancelDrag.current = trackPointerDrag(source, event, {
      start: at => {
        point = at;
        preview = dragPreview(source, label, at);
        setFeedback({ source: entry.path });
        setLanded(undefined);
      },
      move: at => {
        point = at;
        if (!frame.current) frame.current = requestAnimationFrame(draw);
      },
      end: at => {
        const destination = at && findTarget(at);
        cancelDrag.current = undefined;
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        clearTimeout(expandTimer.current);
        preview?.remove();
        if (preview) setFeedback(undefined);
        if (!destination?.allowed || !current.current.move) return;
        pending.current = true;
        void current.current.move(entry, destination.path).then(path => {
          setLanded(path);
          clearTimeout(landedTimer.current);
          landedTimer.current = setTimeout(() => setLanded(undefined), 420);
        }).catch(() => { /* The explorer shows the Vault operation error. */ })
          .finally(() => { pending.current = false; });
      },
    });
  }
  return { feedback, landed, start };
}

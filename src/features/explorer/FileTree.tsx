import { configTitle, isConfiguratorPath } from "../configurator/model";
import { isTreePath, treeTitle } from "../trees/model";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  GitBranch,
  ListTree,
  Folder,
  FolderOpen,
  FolderInput,
  FilePlus2,
  FolderPlus,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import type { VaultEntry } from "../../domain/vault";
import { dirname, isPathInside, withoutMarkdownExtension } from "../../domain/path";
import { useWorkspaceStore } from "../workspace/workspaceStore";

import { useFileTreeDrag } from "./useFileTreeDrag";
import { readExplorerState, saveExplorerState, type ExplorerState } from "./explorerState";

export type FileTreeAction = import("./VaultOperationDialog").VaultOperationRequest | { type: "duplicate"; entry: VaultEntry };

interface FileTreeProps {
  vaultId?: string;
  entries: VaultEntry[];
  vaultRevision: number;
  duplicating?: boolean;
  onAction: (request: FileTreeAction) => void;
  onMove?: (entry: VaultEntry, destination: string) => Promise<string>;
}

// Keep service files available to the Vault adapter and image resolver; only
// their directory is omitted from navigation, including nested attachments.
function visibleEntries(entries: VaultEntry[]) {
  return entries.filter(entry => entry.type !== "directory" || entry.name.toLowerCase() !== "attachments");
}

function EntryIcon({ entry, expanded }: { entry: VaultEntry; expanded: boolean }) {
  if (entry.type === "directory") {
    return expanded ? <FolderOpen size={16} /> : <Folder size={16} />;
  }
  if (isConfiguratorPath(entry.path)) return <GitBranch size={16} />;
  if (isTreePath(entry.path)) return <ListTree size={16} />;
  if (entry.extension === ".md") return <FileText size={16} />;
  return <File size={16} />;
}

interface TreeNodeProps {
  entry: VaultEntry;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  menuPath?: string;
  setMenuPath: (path?: string) => void;
  onAction: FileTreeProps["onAction"];
  drag: ReturnType<typeof useFileTreeDrag>;
  duplicating?: boolean;
}

function TreeNode({ entry, depth, expanded, toggle, menuPath, setMenuPath, onAction, duplicating, drag }: TreeNodeProps) {
  const selectedEntry = useWorkspaceStore((state) => state.selectedEntry);
  const openEntry = useWorkspaceStore((state) => state.openEntry);
  const selectEntry = useWorkspaceStore((state) => state.selectEntry);
  const isDirectory = entry.type === "directory";
  const isExpanded = isDirectory && expanded.has(entry.path);
  const isSelected = selectedEntry?.path === entry.path;
  const isSource = drag.feedback?.source === entry.path;
  const destination = drag.feedback?.target?.path === entry.path ? drag.feedback.target : undefined;
  const displayName = isConfiguratorPath(entry.path) ? configTitle(entry.name) : isTreePath(entry.path) ? treeTitle(entry.name) : entry.extension === ".md" ? withoutMarkdownExtension(entry.name) : entry.name;

  return (
    <li className="tree-node">
      <div className={`tree-row${isSelected ? " is-selected" : ""}${isSource ? " is-drag-source" : ""}${destination ? destination.allowed ? " is-drop-target" : " is-drop-blocked" : ""}${drag.landed === entry.path ? " is-drop-landed" : ""}`}
        data-tree-destination={isDirectory ? entry.path : undefined} style={{ "--tree-depth": depth } as React.CSSProperties}>
        <button
          type="button"
          className="tree-row-main"
          onPointerDown={event => {
            if (event.pointerType !== "touch" && event.button === 0 && event.isPrimary !== false) drag.start(entry, displayName, event.currentTarget, event.nativeEvent);
          }}
          onTouchStart={event => {
            if (event.touches.length === 1) drag.start(entry, displayName, event.currentTarget, event.nativeEvent);
          }}
          onClick={() => {
            if (isDirectory) {
              selectEntry(entry);
              toggle(entry.path);
            } else openEntry(entry);
          }}
          aria-expanded={isDirectory ? isExpanded : undefined}
        >
          <span className="tree-chevron" aria-hidden="true">
            {isDirectory ? isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
          </span>
          <span className="tree-icon" aria-hidden="true"><EntryIcon entry={entry} expanded={isExpanded} /></span>
          <span className="tree-name">{displayName}</span>
          {isDirectory && visibleEntries(entry.children ?? []).length ? <span className="tree-count">{visibleEntries(entry.children ?? []).length}</span> : null}
        </button>
        <button
          type="button"
          className="tree-more"
          aria-label={`Azioni per ${displayName}`}
          aria-expanded={menuPath === entry.path}
          onClick={(event) => {
            event.stopPropagation();
            setMenuPath(menuPath === entry.path ? undefined : entry.path);
          }}
        ><MoreHorizontal size={15} /></button>
      </div>
      {menuPath === entry.path ? (
        <div className="tree-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          {isDirectory ? (
            <>
              <button type="button" role="menuitem" onClick={() => { setMenuPath(undefined); onAction({ type: "create-note", parentPath: entry.path }); }}><FilePlus2 size={15} />Nuova nota</button>
              <button type="button" role="menuitem" onClick={() => { setMenuPath(undefined); onAction({ type: "create-folder", parentPath: entry.path }); }}><FolderPlus size={15} />Nuova cartella</button>
              <span className="tree-menu-separator" />
            </>
          ) : null}
          <button type="button" role="menuitem" onClick={() => { setMenuPath(undefined); onAction({ type: "rename", entry }); }}><Pencil size={15} />Rinomina</button>
          {!isDirectory && entry.extension === ".md" ? <button type="button" role="menuitem" disabled={duplicating} onClick={() => { setMenuPath(undefined); onAction({ type: "duplicate", entry }); }}><Copy size={15} />Duplica nota</button> : null}
          <button type="button" role="menuitem" onClick={() => { setMenuPath(undefined); onAction({ type: "move", entry }); }}><FolderInput size={15} />Sposta in…</button>
          <button className="is-danger" type="button" role="menuitem" onClick={() => { setMenuPath(undefined); onAction({ type: "delete", entry }); }}><Trash2 size={15} />Elimina</button>
        </div>
      ) : null}
      {isDirectory && isExpanded && entry.children?.length ? (
        <ul className={drag.feedback?.expandedOnHover === entry.path ? "is-drag-expansion" : undefined}>
          {visibleEntries(entry.children).map((child) => (
            <TreeNode key={child.id} entry={child} depth={depth + 1} expanded={expanded} toggle={toggle} menuPath={menuPath} setMenuPath={setMenuPath} onAction={onAction} duplicating={duplicating} drag={drag} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FileTree(props: FileTreeProps) {
  return <VaultFileTree key={props.vaultId ?? "current"} {...props} />;
}

function VaultFileTree({ entries, vaultId, onAction, onMove, duplicating }: FileTreeProps) {
  const [initial] = useState<ExplorerState>(() => readExplorerState(vaultId) ?? {
    expanded: entries.filter(entry => entry.type === "directory").map(entry => entry.path), scrollTop: 0,
  });
  const memory = useRef(initial), tree = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState(() => new Set(initial.expanded));
  const [menuPath, setMenuPath] = useState<string>();

  useLayoutEffect(() => {
    const scroller = tree.current?.closest<HTMLElement>(".explorer-scroll");
    if (!scroller) return;
    scroller.scrollTop = memory.current.scrollTop;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(pending);
      memory.current = { ...memory.current, scrollTop: scroller.scrollTop };
      saveExplorerState(vaultId, memory.current);
    };
    const scroll = () => { clearTimeout(pending); pending = setTimeout(flush, 150); };
    scroller.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", flush);
    return () => { flush(); scroller.removeEventListener("scroll", scroll); window.removeEventListener("pagehide", flush); };
  }, [vaultId]);

  useEffect(() => {
    const closeMenu = () => setMenuPath(undefined);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const updateExpansion = (next: Set<string>) => {
    memory.current = { ...memory.current, expanded: [...next] };
    saveExplorerState(vaultId, memory.current);
    setExpanded(next);
  };
  const toggle = (path: string) => {
    const next = new Set(memory.current.expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    updateExpansion(next);
  };
  const expand = (path: string) => {
    const next = new Set(memory.current.expanded);
    if (next.has(path)) return;
    next.add(path);
    updateExpansion(next);
  };
  const drag = useFileTreeDrag(tree, entries, expanded, expand, onMove && (async (entry, destination) => {
    setMenuPath(undefined);
    const path = await onMove(entry, destination);
    const next = new Set(memory.current.expanded.map(item => isPathInside(item, entry.path) ? path + item.slice(entry.path.length) : item));
    if (destination) next.add(destination);
    updateExpansion(next);
    return path;
  }));

  return (
    <ul ref={tree} className={`file-tree${drag.feedback ? " is-dragging" : ""}`} aria-label="Contenuto del Vault">
      {visibleEntries(entries).map((entry) => (
        <TreeNode key={entry.id} entry={entry} depth={0} expanded={expanded} toggle={toggle} menuPath={menuPath} setMenuPath={setMenuPath} onAction={onAction} duplicating={duplicating} drag={drag} />
      ))}
      {drag.feedback && dirname(drag.feedback.source) && <li aria-hidden="true" data-tree-destination=""
        className={`tree-root-drop${drag.feedback.target?.path === "" && drag.feedback.target.allowed ? " is-drop-target" : ""}`}>Sposta nella radice</li>}
    </ul>
  );
}

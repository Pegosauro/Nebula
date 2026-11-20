import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, GitBranch, Layers, ListTree, Pin } from "lucide-react";
import type { VaultEntry } from "../../domain/vault";
import { isConfiguratorPath } from "../configurator/model";
import { isTreePath } from "../trees/model";
import { homePinLimit, selectHomeDocuments, useHomeHistory } from "./homeDocuments";
import { useWorkspaceStore, workspaceDocumentTitle } from "./workspaceStore";

const relative = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });

function openTime(openedAt: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - openedAt) / 60_000));
  if (!minutes) return "Poco fa";
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? relative.format(-hours, "hour") : relative.format(-Math.floor(hours / 24), "day");
}

function existingDocuments(root: readonly VaultEntry[], paths: Set<string>) {
  const result = new Map<string, VaultEntry>();
  function visit(entries: readonly VaultEntry[]) {
    for (const entry of entries) {
      if (!paths.size) return;
      if (entry.type === "file" && paths.delete(entry.path)) result.set(entry.path, entry);
      if (entry.children) visit(entry.children);
    }
  }
  if (paths.size) visit(root);
  return result;
}

export function HomeRecent({ vaultId, root }: { vaultId: string; root: VaultEntry[] }) {
  const panel = useRef<HTMLElement>(null);
  const history = useHomeHistory(state => selectHomeDocuments(state, vaultId));
  const entries = useMemo(() => existingDocuments(root, new Set([...history.pinned, ...history.recent.map(item => item.path)])), [root, history]);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now);
  const pinned = history.pinned.filter(path => entries.has(path));
  const recent = history.recent.filter(item => !pinned.includes(item.path) && entries.has(item.path)).slice(0, 5);

  useEffect(() => {
    useHomeHistory.getState().load(vaultId);
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [vaultId]);

  function row(path: string, fixed: boolean, openedAt?: number) {
    const entry = entries.get(path)!;
    const title = workspaceDocumentTitle(path);
    const Icon = isConfiguratorPath(path) ? GitBranch : isTreePath(path) ? ListTree : FileText;
    return <li className="home-recent-row" key={path}>
      <button className="home-open-document" type="button" title={path} onClick={() => useWorkspaceStore.getState().openEntry(entry)}>
        <Icon size={18} aria-hidden="true" /><span>{title}</span>
      </button>
      {openedAt !== undefined && <time className="home-recent-time" dateTime={new Date(openedAt).toISOString()}>{openTime(openedAt, now)}</time>}
      <button className="home-pin" type="button" aria-label={fixed ? `Rimuovi ${title} dai fissati` : `Fissa ${title}`}
        data-document-path={path}
        aria-pressed={fixed} title={fixed ? "Rimuovi dai fissati" : "Fissa documento"} onClick={() => {
          const changed = useHomeHistory.getState().togglePin(vaultId, path, candidate => entries.has(candidate));
          setMessage(changed ? "" : `Puoi fissare fino a ${homePinLimit} documenti.`);
          if (changed) requestAnimationFrame(() => {
            const button = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".home-pin") ?? [])].find(el => el.dataset.documentPath === path);
            if (document.activeElement === document.body) (button ?? panel.current?.querySelector<HTMLButtonElement>(".home-open-document"))?.focus({ preventScroll: true });
          });
        }}><Pin size={16} aria-hidden="true" /></button>
    </li>;
  }

  return <section ref={panel} className="home-card home-resume" aria-labelledby="home-resume-title">
    <h2 id="home-resume-title" className="home-card-title"><Layers size={20} aria-hidden="true" />Riprendi</h2>
    {pinned.length > 0 && <div className="home-recent-group"><h3>Fissati</h3><ul>{pinned.map(path => row(path, true))}</ul></div>}
    {recent.length > 0 && <div className="home-recent-group"><h3>Recenti</h3><ul>{recent.map(({ path, openedAt }) => row(path, false, openedAt))}</ul></div>}
    {!pinned.length && !recent.length && <p className="home-empty">I documenti che apri compariranno qui.</p>}
    {message && <p className="home-error home-pin-message" role="status">{message}</p>}
  </section>;
}

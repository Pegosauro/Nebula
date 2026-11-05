import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useShellPanels } from "./useShellPanels";

export function ContextPanelOpener() {
  const { canShowContext } = useShellPanels();
  const open = useWorkspaceStore(state => state.setContextPanelOpen);
  useEffect(() => {
    if (!canShowContext) return;
    const shortcut = (event: KeyboardEvent) => {
      if (!event.isComposing && !event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "i") {
        event.preventDefault(); open(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [canShowContext, open]);
  if (!canShowContext) return null;
  return <button type="button" className="context-edge-opener" aria-label="Apri pannello destro" aria-expanded="false" title="Apri pannello destro · Ctrl/⌘ Alt I" onClick={() => open(true)}><ChevronLeft size={18} /><span>Dettagli</span></button>;
}

import { serializeConfigurator } from "../configurator/serializeConfigurator";
import { useConfiguratorStore } from "../configurator/configuratorStore";
import { serializeTree } from "../trees/serializeTree";
import { useTreeStore } from "../trees/treeStore";
import { useEffect } from "react";
import { useDocumentStore } from "./documentStore";

export function DocumentLifecycle() {
  useEffect(() => {
    const checkExternalChanges = () => { void useDocumentStore.getState().checkExternalChanges(); void useConfiguratorStore.getState().checkExternalChanges(); void useTreeStore.getState().checkExternalChanges(); };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsaved = Object.values(useDocumentStore.getState().sessions)
        .some((session) => session.content !== session.savedContent);
      const treesDirty = Object.values(useTreeStore.getState().sessions).some(session => session.conflict || serializeTree(session.data) !== session.saved);
      if (!hasUnsaved && !Object.values(useConfiguratorStore.getState().sessions).some(s=>serializeConfigurator(s.data)!==s.saved) && !treesDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("focus", checkExternalChanges);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.removeEventListener("focus", checkExternalChanges);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, []);
  return null;
}

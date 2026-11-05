import {
  Clock3,
  ChevronsLeft,
  ChevronsRight,
  Files,
  GitBranch,
  Search,
  Settings,
} from "lucide-react";
import { useSettingsStore } from "../settings/settingsStore";
import { IconButton } from "../../components/ui/IconButton";
import { useWorkspaceStore, type ActivitySection } from "../workspace/workspaceStore";

const primaryItems: Array<{
  id: ActivitySection;
  label: string;
  icon: typeof Files;
}> = [
  { id: "files", label: "File", icon: Files },
  { id: "search", label: "Cerca", icon: Search },
  { id: "configurators", label: "Configuratori", icon: GitBranch },
  { id: "recent", label: "Recenti", icon: Clock3 },
];

export function ActivityRail() {
  const activity = useWorkspaceStore((state) => state.activity);
  const setActivity = useWorkspaceStore((state) => state.setActivity);
  const expanded = useSettingsStore(state => state.navigationExpanded);
  const setExpanded = useSettingsStore(state => state.setNavigationExpanded);

  const choose = (section: ActivitySection) => {
    if (section === activity && section !== "settings") useWorkspaceStore.getState().toggleSidebar();
    else {
      setActivity(section);
      if (section !== "settings" && window.innerWidth <= 900) useWorkspaceStore.getState().setSidebarOpen(true);
    }
  };

  return (
    <nav className="activity-rail" aria-label="Aree di Nebula">
      <div className="rail-primary">
        {primaryItems.map(({ id, label, icon: Icon }) => (
          <IconButton key={id} label={label} active={activity === id} onClick={() => choose(id)}>
            <Icon size={20} strokeWidth={1.8} />
            <span className="rail-label">{label}</span>
          </IconButton>
        ))}
      </div>
      <div className="rail-footer">
      <IconButton className="rail-expand" label={expanded ? "Comprimi navigazione" : "Espandi navigazione"} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronsLeft size={19} /> : <ChevronsRight size={19} />}<span className="rail-label">Comprimi</span>
      </IconButton>
      <IconButton label="Impostazioni" active={activity === "settings"} onClick={() => choose("settings")}>
        <Settings size={20} strokeWidth={1.8} />
        <span className="rail-label">Impostazioni</span>
      </IconButton>
      </div>
    </nav>
  );
}

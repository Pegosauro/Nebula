export type ConfiguratorSection = "Esplora" | "Parametri" | "Componenti" | "BOM" | "Grafo" | "Analisi";
const groups: Array<{ label: string; sections: ConfiguratorSection[] }> = [
  { label: "Utilizzo", sections: ["Esplora", "BOM", "Grafo"] },
  { label: "Definizione", sections: ["Parametri", "Componenti"] },
];
export function ConfiguratorNavigation({ section, issues, onChange }: { section: ConfiguratorSection; issues: number; onChange: (section: ConfiguratorSection) => void }) {
  const button = (target: ConfiguratorSection) => <button type="button" key={target} aria-current={section === target ? "page" : undefined} className={section === target ? "is-active" : ""} onClick={() => onChange(target)}>{target}{target === "Analisi" && issues > 0 ? <small aria-label={`${issues} segnalazioni`}>{issues}</small> : null}</button>;
  return <nav className="config-tabs" aria-label="Sezioni configuratore">
    {groups.map(group => <div className="config-tab-group" role="group" aria-label={group.label} key={group.label}><span className="config-tab-group-label">{group.label}</span><div>{group.sections.map(button)}</div></div>)}
    <div className="config-tab-group config-tab-analysis"><span className="config-tab-group-label">Controlli</span><div>{button("Analisi")}</div></div>
  </nav>;
}

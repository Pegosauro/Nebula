import { hasDimensions } from "./componentMeasure";
import type { Configurator } from "./model";
import { componentRule } from "./componentRules";
export interface CatalogFilter { query: string; family: string; group: string; rule: string; measure: string }
export function filterCatalog(data: Configurator, filter: CatalogFilter) {
  const query = filter.query.trim().toLocaleLowerCase();
  return data.components.filter(c => (!query || `${c.code} ${c.name}`.toLocaleLowerCase().includes(query)) && (!filter.family || (c.family ?? "") === filter.family) && (!filter.group || c.group === filter.group) && (!filter.measure || hasDimensions(c) === (filter.measure === "yes")) && (!filter.rule || Boolean(componentRule(data,c.id).rule) === (filter.rule === "yes")));
}
export function CatalogFilters({ data, filter, onChange, count }: { data: Configurator; filter: CatalogFilter; onChange: (filter: CatalogFilter) => void; count: number }) {
  const set = (patch: Partial<CatalogFilter>) => onChange({...filter,...patch});
  return <div className="config-catalog-filters" role="search" aria-label="Filtri catalogo">
    <label>Cerca<input type="search" placeholder="Codice o descrizione" value={filter.query} onChange={e => set({query:e.target.value})}/></label>
    <label>Famiglia<select value={filter.family} onChange={e => set({family:e.target.value,group:""})}><option value="">Tutte</option>{[...new Set(data.components.map(c => c.family).filter(Boolean))].map(f => <option key={f}>{f}</option>)}</select></label>
    <label>Gruppo<select value={filter.group} onChange={e => set({group:e.target.value})}><option value="">Tutti</option>{[...new Set(data.components.filter(c => !filter.family || c.family === filter.family).map(c => c.group).filter(Boolean))].map(g => <option key={g}>{g}</option>)}</select></label>
    <label>Regola<select value={filter.rule} onChange={e => set({rule:e.target.value})}><option value="">Tutte</option><option value="yes">Con regola</option><option value="no">Senza regola</option></select></label>
    <label>Misura<select value={filter.measure} onChange={e => set({measure:e.target.value})}><option value="">Tutte</option><option value="yes">A misura</option><option value="no">Senza misura</option></select></label>
    <span role="status">{count} / {data.components.length}</span>
    {Object.values(filter).some(Boolean) && <button type="button" className="config-text-button" onClick={() => onChange({query:"",family:"",group:"",rule:"",measure:""})}>Azzera filtri</button>}
  </div>;
}

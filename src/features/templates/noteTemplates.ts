import { ensureMarkdownExtension, withoutMarkdownExtension } from "../../domain/path";
import type { VaultSnapshot } from "../../domain/vault";

export const TEMPLATE_DIRECTORY = "Modelli";
export interface NoteTemplate { id: string; name: string; description: string; content?: string; path?: string }
const metadata = (type: string) => `---\ntype: "${type}"\nstatus: "bozza"\nrevision: "1"\ndate: "{{data}}"\n---\n`;
export const BUILTIN_TEMPLATES: readonly NoteTemplate[] = [
  { id: "procedure", name: "Procedura tecnica", description: "Scopo, prerequisiti, passaggi, controlli e problemi frequenti.", content: `${metadata("procedura")}# {{titolo}}\n\n## Scopo e campo di applicazione\n\n_Descrivi lo scopo e indica prodotto, serie o lavorazione._\n\n## Prerequisiti\n\n- Strumenti:\n- Materiali:\n- Documenti di riferimento:\n\n## Passaggi operativi\n\n1. _Descrivi il primo passaggio._\n2. _Descrivi il passaggio successivo._\n\n> [!WARNING]\n> _Indica eventuali avvertenze._\n\n## Controlli finali\n\n- [ ] _Primo controllo._\n- [ ] _Secondo controllo._\n\n## Problemi frequenti e soluzioni\n\n| Problema | Causa | Soluzione |\n| --- | --- | --- |\n| _Da compilare_ | | |\n\n## Note di modifica\n\n- {{data}} — Prima stesura.\n` },
  { id: "solution", name: "Problema e soluzione", description: "Sintomi, contesto, causa, soluzione e verifica del risultato.", content: `${metadata("soluzione")}# {{titolo}}\n\n## Problema riscontrato\n\n_Descrivi i sintomi o il messaggio di errore._\n\n## Contesto\n\n- Prodotto / software:\n- Condizioni in cui si presenta:\n\n## Causa\n\n_Indica la causa individuata._\n\n## Soluzione\n\n1. _Descrivi l’intervento._\n2. _Completa i passaggi necessari._\n\n## Verifica del risultato\n\n- [ ] _Come verificare che il problema sia risolto._\n\n## Riferimenti e note\n\n_Aggiungi collegamenti a note correlate o documenti._\n` },
  { id: "technical-note", name: "Appunto tecnico", description: "Contesto, dati tecnici, osservazioni e azioni successive.", content: `${metadata("nota")}# {{titolo}}\n\n## Contesto\n\n_Prodotto, progetto o attività di riferimento._\n\n## Dati tecnici\n\n- _Inserisci misure, parametri o informazioni utili._\n\n## Osservazioni\n\n_Scrivi le tue osservazioni._\n\n## Azioni successive\n\n- [ ] _Attività da completare._\n\n## Riferimenti\n\n_Collega note, immagini o documenti utili._\n` },
];

export function personalTemplates(snapshot: VaultSnapshot): NoteTemplate[] {
  const folder = snapshot.root.find(entry => entry.type === "directory" && entry.name.toLocaleLowerCase() === TEMPLATE_DIRECTORY.toLocaleLowerCase());
  return (folder?.children ?? []).filter(entry => entry.type === "file" && entry.extension === ".md")
    .map(entry => ({ id: `personal:${entry.path}`, name: withoutMarkdownExtension(entry.name), description: "Modello personale nel Vault", path: entry.path }));
}

export function instantiateTemplate(content: string, requestedTitle: string, date = new Date()): string {
  const title = withoutMarkdownExtension(ensureMarkdownExtension(requestedTitle)).replace(/[\\`*_[\]<>#!|]/g, "\\$&");
  const localDate = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  return content.replace(/\{\{(titolo|data)\}\}/g, (_, token: string) => token === "titolo" ? title : localDate);
}

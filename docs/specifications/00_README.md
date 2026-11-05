# Nebula — Source Pack per Codex

Versione specifica: **0.1 — Foundation**  
Stato: **documento sorgente di progetto**

## Scopo

Nebula è una **Web App PWA local-first** per note Markdown, ispirata ai concetti migliori di Obsidian ma progettata con un'interfaccia più moderna, leggera e coerente.

Il progetto deve permettere di:

- aprire una cartella locale scelta dall'utente e usarla come **Vault**;
- leggere, creare, rinominare, spostare e modificare file `.md` direttamente nella cartella;
- creare collegamenti `[[wikilink]]` tra note;
- mostrare backlink e collegamenti in uscita;
- visualizzare le relazioni tramite una **vista Grafo**;
- creare **Lavagne** basate su Excalidraw;
- funzionare offline come PWA;
- non richiedere account, database remoto o backend per le funzioni principali.

## Principio fondamentale

> I file dell'utente sono la fonte di verità. Nebula non deve imprigionare i dati in un database proprietario.

IndexedDB può essere usato per cache, indice, handle della cartella, preferenze e stato dell'interfaccia, ma i contenuti principali devono restare nella cartella scelta dall'utente.

## Documenti inclusi

1. `01_PRODUCT_VISION.md` — visione, principi e obiettivi.
2. `02_FUNCTIONAL_REQUIREMENTS.md` — requisiti funzionali e priorità.
3. `03_UX_UI_DESIGN_SYSTEM.md` — layout, stile grafico e comportamento UI.
4. `04_INFORMATION_ARCHITECTURE.md` — struttura dell'app e navigazione.
5. `05_VAULT_STORAGE_FILE_SYSTEM.md` — accesso alla cartella locale e persistenza.
6. `06_MARKDOWN_AND_LINK_MODEL.md` — formato Markdown, wikilink, tag e backlink.
7. `07_GRAPH_VIEW.md` — specifica della vista grafo.
8. `08_WHITEBOARD_EXCALIDRAW.md` — lavagne e integrazione Excalidraw.
9. `09_SEARCH_AND_INDEXING.md` — indicizzazione e ricerca locale.
10. `10_PWA_OFFLINE.md` — installazione, cache e aggiornamenti PWA.
11. `11_TECHNICAL_ARCHITECTURE.md` — stack e organizzazione del codice.
12. `12_CODEX_IMPLEMENTATION_RULES.md` — regole operative da dare a Codex.
13. `13_ROADMAP.md` — fasi di sviluppo fino al completamento.
14. `14_QA_ACCEPTANCE.md` — test e criteri di accettazione.
15. `15_ATTACHED_GRAPH_APP_ANALYSIS.md` — elementi riutilizzabili dall'app grafo allegata.
16. `16_FUTURE_IDEAS.md` — funzionalità evolutive da non inserire prematuramente.
17. `17_REFERENCES.md` — riferimenti tecnici.
18. `NEBULA_MASTER_SPEC.md` — sintesi unica da usare quando è preferibile fornire a Codex una sola fonte.

## Priorità di lettura per Codex

In caso di conflitto tra documenti usare questo ordine:

1. `12_CODEX_IMPLEMENTATION_RULES.md`
2. `NEBULA_MASTER_SPEC.md`
3. documenti specifici numerati
4. `16_FUTURE_IDEAS.md`

Le idee future non devono modificare lo scope della fase corrente senza una decisione esplicita.

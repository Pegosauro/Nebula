# Nebula — Roadmap di sviluppo

## Fase 0 — Foundation

Obiettivo: progetto avviabile e design system minimo.

Deliverable:

- React + TypeScript + Vite;
- shell PWA;
- design token light/dark;
- activity rail;
- sidebar vuota;
- workspace tab;
- right panel;
- status bar;
- routing/stores di base;
- test setup.

Acceptance:

- app avviabile;
- nessun backend;
- tema cambia senza flash evidente;
- layout responsive di base.

## Fase 1 — Vault locale

- `Apri cartella`;
- permissions;
- handle IndexedDB;
- scan file tree;
- create/rename/move/delete;
- recent Vault.

Acceptance:

- riaprire PWA non richiede riselezione cartella se handle disponibile e permesso recuperabile;
- nessuna operazione esce dal Vault;
- errori filesystem gestiti.

## Fase 2 — Editor Markdown

- CodeMirror;
- tabs;
- read/write `.md`;
- autosave;
- Ctrl+S;
- preview Markdown sanificata;
- dirty state.

Acceptance:

- modifica → file fisico aggiornato;
- write failure non perde testo;
- cambio tab non perde testo.

## Fase 3 — Wikilink e knowledge model

- parser link;
- autocomplete `[[`;
- link click;
- unresolved;
- backlinks/outgoing;
- create-from-link.

Acceptance:

- backlink aggiornati dopo save;
- link ambigui non aprono file casuali.

## Fase 4 — Search / Quick Switcher

- index worker;
- filename/path;
- full text;
- quick switcher;
- progress initial index.

## Fase 5 — Graph P0

- graph model dall'indice link;
- global graph;
- pan/zoom/fit;
- select/hover;
- filters;
- apertura nota.

In questa fase adattare le parti utili del progetto grafo allegato.

## Fase 6 — Graph P1

- local graph;
- adaptive radial layout;
- physics inspector;
- pinned nodes;
- performance worker;
- persistence camera/positions.

## Fase 7 — Whiteboard

- Excalidraw lazy-loaded;
- create/open/save board;
- autosave;
- theme sync;
- note links dagli elementi.

## Fase 8 — Editor avanzato

- outline;
- heading links;
- embeds;
- task checkbox;
- split panes;
- drag images/attachments;
- rename link update.

## Fase 9 — UX productivity

- command palette;
- shortcuts editor;
- favorites/recent;
- context menu;
- settings complete;
- session restore;
- onboarding.

## Fase 10 — PWA hardening

- offline audit;
- service worker update UX;
- install flow;
- cache audit;
- recovery tests;
- browser capability screen.

## Fase 11 — Performance / large Vault

- benchmark 1k/5k/10k notes;
- virtualized explorer;
- incremental indexing;
- graph level of detail;
- memory profiling;
- long-task audit.

## Fase 12 — Release 1.0

- QA completa;
- onboarding finale;
- help shortcuts;
- import/test con Vault Obsidian reale;
- changelog;
- backup progetto sorgente;
- build produzione.

## Regola roadmap

Non implementare tutte le fasi in una singola modifica. Ogni fase deve restare testabile e recuperabile.

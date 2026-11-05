# NEBULA — MASTER SPEC

## 1. Missione

Creare una PWA local-first per note Markdown chiamata **Nebula**, con editor, wikilink, backlink, ricerca, grafo e lavagne Excalidraw. L'utente seleziona personalmente la cartella del Vault e Nebula legge/scrive direttamente i file locali.

## 2. Vincoli non negoziabili

1. Note = file `.md` reali.
2. Vault = cartella scelta dall'utente.
3. Nessun backend necessario per le funzioni core.
4. Nessun account obbligatorio.
5. Nessun upload delle note su server Nebula.
6. IndexedDB è cache/stato, non fonte unica.
7. UI fluida anche durante indicizzazione/grafo.
8. PWA offline senza dipendenze runtime CDN.
9. HTML Markdown sempre sanificato.
10. Le modifiche recenti dell'utente prevalgono su questa specifica e devono essere riportate nei documenti.

### Aggiornamento utente 0.14.0

- Le cartelle `attachments` non sono mostrate nell'albero del Vault; i file restano disponibili agli adapter e ai riferimenti delle immagini.
- Le tabelle permettono unioni rettangolari di celle e larghezze delle colonne. I valori restano nella griglia Markdown; metadati locali versionati nel commento `nebula-table` conservano unioni e larghezze nello stesso `.md`. Scrivi e lettura rendono la tabella senza mostrare il commento; Sorgente conserva il file completo. Intestazioni e corpo si uniscono separatamente. HTML sanificato prima di applicare dimensioni numeriche validate.
- La pagina in Scrivi mantiene la larghezza scelta e i margini centrati della lettura. Tabelle larghe scorrono nel proprio contenitore.

## 3. Stack

- React 19 + TypeScript + Vite
- CodeMirror 6
- Excalidraw React
- IndexedDB
- Web Workers per indice/grafo
- PWA service worker
- test unit + E2E

## 4. UI

Desktop:

```text
Activity Rail | Sidebar | Workspace tabs/editor/graph/board | Context Panel
                                     Status bar
```

Look:

- grafite/ardesia;
- light + dark;
- accent violetto Nebula, ciano secondario;
- bordi sottili;
- icone pulite;
- micro-animazioni brevi;
- pannelli collassabili;
- command palette.

## 5. Vault lifecycle

```text
User click
  → showDirectoryPicker(readwrite)
  → save DirectoryHandle in IndexedDB
  → scan asynchronously
  → build file tree
  → parse note metadata
  → build search/backlink/graph indexes
  → restore workspace
```

On next launch:

```text
load handle → query permission → user click reconnect if prompt → open vault
```

## 6. Note

P0:

- create/read/edit/save/rename/move/delete;
- CodeMirror;
- autosave;
- tabs;
- Markdown preview;
- dirty state.

P1:

- split panes;
- outline;
- embeds;
- attachments;
- tasks/callouts;
- update wikilinks on rename with confirmation.

## 7. Links

Syntax principale:

```md
[[Note]]
[[Folder/Note]]
[[Note|Alias]]
[[Note#Heading]]
```

Indice derivato:

```text
outgoing / incoming / unresolved / tags / aliases / headings
```

## 8. Search

- filename/path fuzzy search;
- full text;
- Quick Switcher;
- worker indexing;
- incremental update after save.

## 9. Graph

Global Graph:

- nodes = note/board;
- edges = actual links;
- pan/zoom/fit;
- select/hover;
- filters;
- color modes;
- progressive labels.

Local Graph:

- active note center;
- depth 1–3 BFS;
- adaptive radial layout;
- physics controls;
- manual pinned nodes.

Use the attached ConfigApp graph project as algorithmic reference for adaptive spacing, collision, settling, manual positions and settings, but do not use its `parentId/level` data model as the Nebula knowledge graph.

## 10. Whiteboard

- `.excalidraw` files in Vault;
- lazy loaded Excalidraw editor;
- autosave;
- note links stored as safe custom metadata;
- board links included in graph;
- `![[Board.excalidraw]]` embed support P1.

## 11. Storage

Vault:

```text
*.md
*.excalidraw
attachments/
.nebula/           # optional metadata only
```

IndexedDB:

```text
vault handles
settings
workspace/session
search cache
backlink cache
graph cache/manual positions
```

## 12. Performance

- no full Vault in React state;
- workers for heavy parse/layout;
- incremental indexing;
- lazy graph/Excalidraw;
- debounce filesystem writes;
- virtualized lists for large Vault;
- graph labels according to zoom/importance.

## 13. Safety

- path normalization;
- block traversal;
- no code execution from Markdown;
- sanitized HTML;
- no silent delete;
- no dirty buffer loss after write failure;
- detect external file changes.

## 14. Implementation phases

0. Foundation UI
1. Vault file access
2. Markdown editor
3. Wikilinks/backlinks
4. Search
5. Global graph
6. Local/adaptive graph
7. Excalidraw boards
8. Advanced editor/productivity
9. UX productivity
10. PWA hardening
11. Large Vault performance
12. Release QA

## 15. Definition of Done

A feature is done only when:

- behavior works end-to-end;
- errors are handled;
- tests pass;
- dark/light do not regress;
- no critical console errors;
- no data-loss scenario identified;
- docs updated.


### Aggiornamento utente 0.15.0 — Configuratori

Integrare un modulo strutturato locale separato dall’editor Markdown con parametri, componenti, regole visuali, esplorazione, BOM, grafo specifico e analisi. Dati `.config.json` nel Vault, link dalle note, salvataggio protetto. Definizione implementata e limiti: `docs/CONFIGURATOR_GUIDE.md`.

### Aggiornamento utente 0.16.0 — Liste del configuratore

Parametri, componenti e regole diventano righe compatte con riepilogo; i dettagli si compilano in un dialogo nativo con Applica/Annulla. Le bozze restano isolate fino alla conferma. Componenti e regole si riordinano mediante drag&drop (mouse/touch), frecce su/giù o tastiera sulla maniglia. L’ordine delle liste è persistito negli array del file .config.json, con gli stessi identificativi e senza nuove priorità delle regole.

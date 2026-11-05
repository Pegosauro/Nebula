# Nebula — Technical Architecture

## Stack proposto

- **React 19**
- **TypeScript**
- **Vite**
- **CodeMirror 6** per editor Markdown
- **@excalidraw/excalidraw** per lavagne
- **Zustand** o store equivalente leggero per stato applicazione
- **IndexedDB** tramite Dexie o adapter minimale
- parser Markdown basato su unified/remark oppure markdown-it, con estensioni wikilink gestite da plugin/parser dedicato
- sanitizzazione HTML con DOMPurify o equivalente
- PWA con `vite-plugin-pwa`/Workbox oppure service worker controllato direttamente
- **Vitest** per unit/component test
- **Playwright** per E2E desktop

L'uso di una libreria deve essere giustificato se una soluzione browser nativa è sufficiente.

## Architettura a layer

```text
UI
├── shell
├── explorer
├── editor
├── graph
├── whiteboard
└── settings

Application
├── commands
├── document sessions
├── navigation
└── workspace state

Domain
├── document model
├── links/backlinks
├── graph model
├── search model
└── settings schema

Infrastructure
├── filesystem adapter
├── indexeddb cache
├── markdown parser
├── search index
├── graph worker
└── service worker
```

## Regola importante

I componenti React non devono chiamare direttamente `showDirectoryPicker`, IndexedDB o `createWritable()` ovunque.

Usare adapter/service chiari:

```ts
interface VaultAdapter {
  openVault(): Promise<VaultRef>;
  list(path: string): Promise<Entry[]>;
  readText(path: string): Promise<FileSnapshot>;
  writeText(path: string, content: string): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}
```

## Document identity

Non usare soltanto il basename come ID.

P0:

```text
DocumentId = normalized relative path
```

Quando un file viene rinominato, il dominio deve emettere un evento rename per aggiornare tab, indice e link.

In futuro può essere introdotto un ID persistente opzionale, ma non è necessario per la base.

## State stores

Separare almeno:

- `vaultStore`
- `workspaceStore`
- `documentStore`
- `searchStore`
- `graphStore`
- `settingsStore`

Evitare un unico store globale enorme.

## Event model

Eventi utili:

```text
vault:opened
vault:closed
file:created
file:changed
file:renamed
file:moved
file:deleted
document:saved
index:updated
graph:updated
```

Backlink, ricerca e grafo reagiscono agli eventi del dominio, non ai dettagli UI.

## Web Workers

Worker dedicati consigliati:

### `index.worker.ts`
- parser note;
- full-text indexing;
- link resolution batch.

### `graph.worker.ts`
- force simulation/layout;
- collision/settling;
- calcoli di grafo grandi.

## Graph package interno

Struttura:

```text
src/features/graph/
  GraphView.tsx
  GraphToolbar.tsx
  GraphInspector.tsx
  renderer/
  engine/
    graphModel.ts
    layoutForce.ts
    layoutRadial.ts
    overlap.ts
  workers/
    graph.worker.ts
```

Usare `ConfigApp/src/graphLayout.js` allegato come riferimento algoritmico, non come data model definitivo.

## File structure iniziale

```text
src/
  app/
  components/
  features/
    vault/
    explorer/
    editor/
    search/
    graph/
    whiteboard/
    settings/
  domain/
  infrastructure/
  workers/
  styles/
  test/
```

## CSS

- design token globali;
- CSS modules o soluzione equivalente semplice;
- evitare dipendenza da utility class ovunque se rende difficile mantenere il design system;
- nessun colore hard-coded nei feature component.

## Performance rules

- lazy load Excalidraw;
- lazy load Graph view;
- virtualizzare liste file se necessario;
- debounce salvataggio;
- parsing pesante in worker;
- non serializzare scene Excalidraw a ogni pointer event;
- non salvare tutto il Vault nello store React.

## Error boundaries

Aree critiche con boundary/handling:

- editor;
- graph;
- whiteboard;
- filesystem operations.

Un crash del grafo non deve far perdere una nota aperta.

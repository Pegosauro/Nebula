# Nebula — Analisi dell'app Grafo allegata (`ConfigApp`)

## Contenuto analizzato

L'archivio allegato contiene un progetto Vite/React e una build già generata. I file sorgente rilevanti includono:

```text
ConfigApp/src/App.jsx
ConfigApp/src/graphLayout.js
ConfigApp/src/graphProject.js
ConfigApp/src/nodeTree.js
ConfigApp/src/NodeTree.jsx
ConfigApp/src/styles.css
```

Il package dichiara React 19.2 e Vite 6.4.

## Aspetti utili

### 1. Layout separato dall'interfaccia
`graphLayout.js` contiene la matematica/layout senza dipendere direttamente dal rendering React. È un buon modello architetturale da mantenere.

### 2. Settings fisica
Sono presenti parametri espliciti:

```js
repulsion
linkStrength
minDistance
settling
animationSpeed
```

Nebula deve mantenere un set equivalente, eventualmente rinominato e ampliato con link distance/collision.

### 3. Dimensioni nodo
Il layout considera width/height reali e non tratta tutti i nodi come punti identici. Questo migliora la gestione delle label e degli overlap.

### 4. Link multipli
La funzione `buildGraphLinks()` distingue:

- parent links;
- context links.

In Nebula il concetto può essere generalizzato in `edge.kind`, ma la relazione `parent` non è il modello predefinito delle note.

### 5. Adaptive spacing
Il codice calcola domanda di circonferenza, estensione dei nodi, densità e raggi progressivi. È particolarmente interessante come base per il **Local Graph radiale**.

### 6. Branch angle allocation
La disposizione angolare cerca di assegnare spazio alle diramazioni in funzione del peso dei sottoinsiemi, invece di usare angoli uniformi ciechi.

### 7. Persistenza vista
`graphProject.js` serializza:

- nodes;
- links contestuali;
- settings;
- camera view.

Per Nebula la stessa separazione è valida, ma la topologia non deve essere persistita come fonte primaria perché viene ricostruita dai file.

Persistire soltanto:

- camera;
- settings;
- pinned/manual positions;
- preferenze visuali.

### 8. Tree + graph coordinati
L'app allegata possiede anche `NodeTree.jsx` con selezione, rename, drag & drop e menu contestuale. Il concetto di selezione sincronizzata fra lista e canvas è utile.

Per Nebula:

- selezione file explorer → evidenzia nel local graph se aperto;
- selezione nodo grafo → apre/evidenzia nota;
- nessun editor di gerarchia del grafo separato dal filesystem.

## Aspetti da NON trasferire direttamente

### Nodi hard-coded
I sample nodes devono sparire completamente.

### `parentId`
Non rappresenta il knowledge graph di Nebula.

### `level` persistente
Nel Global Graph non esiste un livello semantico fisso.

Nel Local Graph il livello è calcolato dinamicamente come distanza BFS dal nodo attivo.

### localStorage progetto
Il Vault e le note non devono vivere in localStorage.

## Strategia di riuso

1. Portare le funzioni matematiche utili in TypeScript.
2. Aggiungere test prima della modifica semantica.
3. Sostituire node tree model con `GraphNode/GraphEdge` derivati dall'indice Nebula.
4. Conservare collision, spacing e settling.
5. Implementare due layout:
   - Force Graph globale;
   - Adaptive Radial locale.
6. Spostare simulazioni costose in worker.
7. Rendere renderer intercambiabile SVG/Canvas.

## Risultato atteso

Il grafo Nebula deve mantenere la chiarezza e la controllabilità dell'app allegata, ma essere guidato dai collegamenti reali fra note e non da una struttura gerarchica costruita manualmente.

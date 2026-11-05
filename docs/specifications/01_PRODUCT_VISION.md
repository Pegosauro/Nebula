# Nebula — Product Vision

## Identità

**Nome:** Nebula  
**Categoria:** local-first knowledge workspace / Markdown notes PWA  
**Obiettivo:** rendere semplice la creazione di una rete personale di note, idee e lavagne senza dipendere da servizi cloud.

## Visione

Nebula deve dare la sensazione di lavorare su uno spazio personale continuo: la struttura delle cartelle rimane disponibile, ma non deve essere l'unico modo di orientarsi. Note, link, backlink, ricerca, grafo e lavagne sono viste diverse dello stesso Vault.

## Principi di prodotto

### 1. Local-first
Le note appartengono all'utente e vengono scritte nella cartella selezionata.

### 2. Markdown-first
Il formato standard di una nota è `.md`. Il contenuto deve restare utile anche aprendo il file con un normale editor di testo.

### 3. Nessun lock-in inutile
La struttura del Vault deve restare comprensibile senza Nebula.

### 4. Navigazione immediata
Ogni nota deve essere raggiungibile rapidamente tramite file tree, Quick Switcher, ricerca, link o grafo.

### 5. Collegamenti come funzione centrale
La rete di relazioni non è un'aggiunta estetica: deve essere integrata nell'editor, nei suggerimenti e nel pannello contestuale.

### 6. UI moderna ma discreta
Nebula deve essere riconoscibile senza diventare “fantascientifica” o decorativa. La metafora Nebula deve emergere soprattutto da profondità, micro-animazioni, accento cromatico e grafo.

### 7. Prestazioni percepite
L'interfaccia deve rispondere immediatamente. Indicizzazione, layout del grafo e operazioni pesanti devono evitare di bloccare la digitazione.

### 8. Keyboard-first, non keyboard-only
Ogni funzione frequente deve essere utilizzabile da tastiera, ma l'app deve restare intuitiva con mouse e touch.

## Target iniziale

Desktop Chromium, in particolare Edge/Chrome, perché la selezione persistente di una cartella locale tramite File System Access API è fondamentale per il comportamento richiesto.

## Non-obiettivi iniziali

Nella prima release stabile NON sono richiesti:

- account Nebula;
- salvataggio cloud proprietario;
- collaborazione multiutente;
- marketplace plugin;
- AI obbligatoria;
- sincronizzazione proprietaria;
- database server;
- editor WYSIWYG complesso che nasconde completamente Markdown.

Queste funzioni possono essere valutate in seguito senza compromettere il modello local-first.

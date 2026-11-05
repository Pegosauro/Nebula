# Nebula — Information Architecture

## Entità principali

### Vault
Cartella root scelta dall'utente.

### Note
File Markdown `.md`.

### Board
Documento lavagna, preferibilmente `.excalidraw`, indicizzato da Nebula e collegabile alle note.

### Attachment
File non Markdown contenuto nel Vault.

### Link
Relazione derivata dal contenuto, principalmente wikilink Markdown.

### Workspace State
Informazioni UI non appartenenti al contenuto: tab, pannelli, dimensioni, ultimo file aperto, preferenze.

## Modello di navigazione

Nebula non deve usare URL pubblici per rappresentare il percorso reale del filesystem. È preferibile un router interno con ID/path normalizzato.

Viste principali:

- `workspace/note`
- `workspace/board`
- `workspace/graph/global`
- `workspace/graph/local`
- `settings`

## Activity Rail

### File
- Explorer
- Recenti
- Preferiti

### Search
- Quick search
- Full text
- filtri

### Graph
- Globale
- Locale

### Boards
- elenco lavagne
- nuova lavagna

### Settings
- aspetto
- editor
- file
- grafo
- lavagne
- scorciatoie
- PWA/app info

## Right Context Panel

È una singola area con schede contestuali, non molti pannelli indipendenti sovrapposti.

Editor:

1. Outline
2. Backlinks
3. Outgoing
4. Properties

Grafo:

1. Filters
2. Appearance
3. Physics
4. Selection

Lavagna:

1. Selection properties
2. Note link
3. Layers/library se richiesto dall'integrazione

## Apertura documenti

Ogni documento aperto crea una View Instance.

Una stessa nota può essere visualizzata in più split senza duplicare il file sottostante.

Concetti distinti:

- `Document`: file fisico.
- `View`: istanza visuale del documento.
- `Tab`: contenitore della view.
- `Pane`: gruppo di tab.

Questa separazione evita problemi quando verranno aggiunti split e tab multipli.

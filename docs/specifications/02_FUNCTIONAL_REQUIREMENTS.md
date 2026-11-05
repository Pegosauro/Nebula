# Nebula — Functional Requirements

Le priorità sono indicate come:

- **P0**: indispensabile per la prima versione utilizzabile.
- **P1**: necessario per la prima release completa.
- **P2**: miglioramento successivo.

## Vault

### P0
- Schermata iniziale con `Apri cartella`.
- Selezione della cartella tramite `showDirectoryPicker({ mode: "readwrite" })` dove supportato.
- Memorizzazione dell'handle della cartella in IndexedDB.
- Riapertura rapida dell'ultimo Vault con richiesta permessi quando necessaria.
- Cambio Vault e disconnessione del Vault corrente.
- Scansione ricorsiva di cartelle e file supportati.
- Nessuna scrittura al di fuori della cartella autorizzata.

### P1
- Elenco Vault recenti.
- Possibilità di assegnare un nome visuale a un Vault senza rinominare la cartella.

## File explorer

### P0
- Albero cartelle/file.
- Espandi/comprimi cartelle.
- Crea nota.
- Crea cartella.
- Rinomina.
- Sposta con drag & drop.
- Elimina con conferma.
- Menu contestuale custom.
- Aggiornamento UI dopo ogni operazione.

### P1
- Selezione multipla.
- Preferiti.
- Recenti.
- Ordinamento per nome/modifica/tipo.
- Indicatore di file modificato.

## Editor Markdown

### P0
- Editor CodeMirror 6.
- Syntax highlighting Markdown.
- Auto-save dopo breve inattività.
- `Ctrl/Cmd + S` per salvataggio immediato.
- Undo/Redo editor.
- Titolo derivato dal nome file.
- Tab documenti.
- Riapertura tab precedenti.

### P1
- Split view orizzontale/verticale.
- Modalità Source / Reading / Live Preview semplificata.
- Heading outline.
- Checkbox task interattive.
- Code block con linguaggio.
- Tabelle Markdown.
- Callout compatibili con sintassi Obsidian dove possibile.

## Collegamenti

### P0
- Supporto `[[Nota]]`.
- Supporto `[[Cartella/Nota]]`.
- Supporto alias `[[Nota|Testo visualizzato]]`.
- Autocomplete dopo `[[`.
- Click sul wikilink per aprire la nota.
- Evidenziazione link non risolti.
- Creazione rapida di una nota quando un link non esiste.
- Pannello Backlink.
- Pannello Link in uscita.

### P1
- Link a heading `[[Nota#Titolo]]`.
- Tag `#tag` indicizzati.
- Rinominando una nota, proposta di aggiornamento dei wikilink che la referenziano.

## Ricerca

### P0
- Ricerca per nome/percorso.
- Ricerca full-text locale.
- Quick Switcher.

### P1
- Filtri `path:`, `tag:`, `type:`.
- Ricerca nei backlink.
- Evidenziazione risultati nel testo.

## Grafo

### P0
- Grafo globale di tutte le note indicizzate.
- Nodo = nota.
- Arco = wikilink effettivo tra note.
- Pan, zoom, fit-to-screen.
- Click nodo = apertura nota.
- Hover = evidenzia nodo e vicini.
- Ricerca nodo.
- Filtri basilari.

### P1
- Grafo locale della nota attiva.
- Profondità 1–3 livelli.
- Colore per cartella o tag.
- Dimensione nodo proporzionale al numero di link.
- Fisica configurabile.
- Blocco manuale della posizione di singoli nodi.
- Salvataggio layout opzionale.

## Lavagne

### P0
- Nuova Lavagna.
- Editor Excalidraw integrato.
- Salvataggio locale del documento lavagna.
- Inserimento testo, forme, frecce, immagini e disegno libero.
- Undo/Redo.
- Autosave.

### P1
- Elemento collegabile a una nota Nebula.
- Apertura nota da elemento collegato.
- Lavagne presenti nella ricerca e nel grafo.
- Embed della lavagna in una nota Markdown.

## Allegati

### P1
- Drag & drop immagini nell'editor.
- Copia fisica in una cartella allegati configurabile.
- Inserimento link relativo nel Markdown.
- Preview immagini.
- Apertura PDF/altri allegati con viewer del browser quando possibile.

## Command Palette

### P1
Comando `Ctrl/Cmd + P` con ricerca fuzzy tra azioni:

- nuova nota;
- nuova lavagna;
- apri nota;
- cerca;
- grafo globale;
- grafo locale;
- toggle tema;
- mostra/nascondi pannelli;
- impostazioni.

## Preferenze

### P1
- Tema: Sistema / Chiaro / Scuro.
- Dimensione UI.
- Font editor.
- Line height.
- Cartella allegati.
- Auto-save delay.
- Comportamento link.
- Impostazioni grafo.
- Impostazioni lavagna.
- Scorciatoie.

## Sicurezza e affidabilità

### P0
- Sanitizzazione dell'HTML renderizzato.
- Nessuna esecuzione arbitraria del contenuto Markdown.
- Operazioni file con gestione errori esplicita.
- Nessuna cancellazione silenziosa.
- Salvataggio atomico per quanto possibile con File System Access API.
- Stato dirty mantenuto se la scrittura fallisce.

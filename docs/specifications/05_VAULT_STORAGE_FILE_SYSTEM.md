# Nebula — Vault, Storage e File System

## Obiettivo

Il Vault è una cartella scelta esplicitamente dall'utente. Nebula deve operare direttamente sui file della cartella senza copiarli in un database proprietario.

## Strategia primaria

Su browser compatibili:

```js
const handle = await window.showDirectoryPicker({
  id: "nebula-vault",
  mode: "readwrite",
});
```

Il picker deve essere avviato da un gesto utente.

## Persistenza handle

Il `FileSystemDirectoryHandle` può essere salvato in IndexedDB.

All'avvio:

1. recuperare l'handle;
2. verificare `queryPermission({mode: "readwrite"})`;
3. se `granted`, aprire il Vault;
4. se `prompt`, mostrare un pulsante `Riconnetti Vault` che chiami `requestPermission()` a seguito del click;
5. se `denied`, chiedere di riselezionare la cartella.

Non mostrare un loop automatico di richieste permessi.

## Cosa salvare su disco nel Vault

Contenuto principale:

- `*.md`
- `*.excalidraw`
- immagini/allegati

Cartella tecnica opzionale:

```text
.nebula/
  graph-layout.json
  workspace.json        # opzionale, se l'utente abilita workspace portabile
```

Per default le preferenze puramente locali possono restare in IndexedDB/local storage in modo da non sporcare il Vault.

## Cosa salvare in IndexedDB

- directory handle del Vault;
- identificatore locale del Vault;
- indice di ricerca ricostruibile;
- mappa backlink ricostruibile;
- cache metadati file;
- preferenze UI;
- tab/session state;
- layout grafo se l'utente non abilita la persistenza nel Vault.

L'IndexedDB NON deve contenere l'unica copia delle note.

## Scansione

La scansione del Vault deve:

- essere asincrona;
- ignorare cartelle tecniche configurabili, per esempio `.git`, `.obsidian`, `.trash`, `node_modules`;
- non caricare in memoria il contenuto completo di tutti gli allegati;
- leggere testo solo per file indicizzabili;
- produrre eventi/progress per Vault grandi.

## Operazioni file

Creazione nota:

1. normalizzare nome e percorso;
2. impedire path traversal;
3. assicurarsi che l'estensione sia `.md`;
4. creare il file;
5. scrivere contenuto iniziale;
6. aggiornare indice e UI.

Rinomina/spostamento:

La File System Access API non espone in modo uniforme una `rename()` universale. Implementare una strategia affidabile copia + verifica + delete quando necessario, senza perdere il file originale se la copia fallisce.

## Salvataggio

Il salvataggio deve usare `createWritable()` e chiudere lo stream solo dopo la scrittura completa.

Se il salvataggio fallisce:

- mantenere lo stato dirty;
- mostrare errore non distruttivo;
- non sostituire il buffer editor con il contenuto precedente;
- permettere retry.

## Modifiche esterne

Una cartella può essere modificata da Obsidian, VS Code, Git o altri programmi.

Strategia:

- memorizzare `lastModified` e dimensione dell'ultima versione letta;
- al focus della PWA verificare i file aperti e i metadati principali;
- se il file è cambiato esternamente e l'editor NON è dirty: ricaricare con indicatore discreto;
- se è cambiato esternamente mentre l'editor è dirty: mostrare conflitto e offrire `Mantieni Nebula`, `Ricarica da disco`, `Confronta` in fase successiva.

Quando disponibile e stabile, un observer filesystem può essere aggiunto come ottimizzazione, non come unico meccanismo.

## Browser support

La selezione diretta di cartella con `showDirectoryPicker()` non è disponibile in modo uniforme su tutti i browser. Nebula deve fare feature detection.

### Modalità Full Local Vault
Richiede File System Access API con accesso directory read/write. È il target principale desktop.

### Fallback futuro
Su browser non compatibili, prevedere una modalità separata (non finta): import/export o OPFS. Non promettere accesso diretto alla cartella se il browser non lo consente.

## Privacy

- Nessun file deve essere inviato a server Nebula.
- Nessuna telemetria contenente testo delle note.
- Eventuale telemetria futura deve essere opt-in e priva di contenuto utente.
- Tutte le funzioni principali devono funzionare offline dopo il caricamento/installazione della PWA.

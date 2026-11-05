# Nebula — Whiteboard / Excalidraw

## Obiettivo

Le Lavagne devono offrire uno spazio libero visuale integrato con la rete di note.

## Libreria

Integrazione consigliata: componente React ufficiale `@excalidraw/excalidraw`.

Nebula deve isolare l'integrazione dietro un adapter per non legare l'intero dominio al formato interno di Excalidraw.

## Formato file

Scelta iniziale consigliata:

```text
Nome Lavagna.excalidraw
```

È un file JSON della lavagna salvato direttamente nel Vault.

Motivi:

- formato nativo e semplice da serializzare;
- nessuna duplicazione del contenuto grafico dentro Markdown;
- file facilmente identificabile;
- la lavagna può essere referenziata da una nota Markdown.

Le note restano `.md`; le lavagne sono un secondo tipo di documento del Vault.

## Embed da nota

P1:

```md
![[Diagrammi/Architettura.excalidraw]]
```

La Reading View mostra una preview della lavagna con azione `Apri lavagna`.

## Collegamenti lavagna → note

Nebula aggiunge metadati controllati sugli elementi collegabili.

Esempio concettuale:

```json
{
  "nebula": {
    "link": "[[Progetto Nebula]]"
  }
}
```

L'implementazione effettiva deve usare un campo custom supportato senza compromettere il documento Excalidraw.

Azioni:

- tasto destro elemento → `Collega a nota`;
- autocomplete note;
- icona/link discreto sull'elemento;
- doppio click o comando dedicato apre la nota.

Queste relazioni alimentano anche il grafo con `kind: board-link`.

## Salvataggio

- debounce 700–1200 ms;
- indicatore `Salvataggio...` solo quando necessario;
- write failure non deve far perdere la scena in memoria;
- `Ctrl/Cmd + S` salva immediatamente;
- evitare di scrivere il file su ogni pointer move.

## Nuova lavagna

Flusso:

1. `Nuovo` → `Lavagna`;
2. nome;
3. cartella di destinazione;
4. crea file `.excalidraw`;
5. apre editor;
6. indice si aggiorna.

## UI

Excalidraw deve essere integrato visivamente con Nebula:

- tema sincronizzato;
- chrome esterno ridotto;
- tab Nebula invariata;
- pannello contestuale Nebula opzionale;
- evitare doppie toolbar ridondanti quando possibile.

## Immagini

Le immagini inserite nella lavagna devono essere salvate in modo affidabile.

Opzioni da valutare in implementazione:

1. embedded data nel documento Excalidraw;
2. asset separato nel Vault.

Preferire compatibilità e integrità del formato prima di ottimizzare lo spazio.

## Grafo

Una lavagna è un nodo di tipo `board` se contiene almeno un link verso note/lavagne oppure se l'utente abilita la visualizzazione di tutti i board.

Le relazioni sono estratte dai metadati Nebula degli elementi.

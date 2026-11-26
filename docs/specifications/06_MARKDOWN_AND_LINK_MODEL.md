# Nebula — Markdown e Link Model

## Formato note

Ogni nota standard è un file `.md` UTF-8.

Nebula deve preferire sintassi Markdown comprensibile e interoperabile.

## Frontmatter

Supportare YAML frontmatter all'inizio del file:

```yaml
---
aliases:
  - Nome alternativo
tags:
  - progetto
  - ricerca
cssclasses:
  - wide-note
---
```

Nebula non deve aggiungere frontmatter automaticamente a tutte le note se non necessario.

## Wikilink

Supportare:

```md
[[Nota]]
[[Cartella/Nota]]
[[Nota|Alias visualizzato]]
[[Nota#Sezione]]
```

P0 può partire dai primi tre formati; link a heading entra nella fase successiva.

## Risoluzione link

Ordine consigliato:

1. match esatto del path relativo senza `.md`;
2. match esatto del basename;
3. match case-insensitive;
4. alias da frontmatter;
5. se più file corrispondono, mostrare selettore di disambiguazione.

Non scegliere silenziosamente un file ambiguo.

## Link non risolti

Un wikilink senza destinazione deve essere rappresentato come unresolved.

Click:

- se esiste un'unica destinazione prevista, crea la nota;
- se il path include cartelle, creare le cartelle solo dopo conferma se non esistono;
- aggiornare immediatamente indice e grafo.

## Link standard Markdown

Supportare anche:

```md
[Etichetta](Percorso/Nota.md)
```

Per il grafo P0, i wikilink sono la relazione primaria. I link Markdown interni possono entrare nello stesso indice una volta normalizzati.

## Backlink index

Per ogni nota mantenere:

```ts
outgoing: Set<DocumentId>
incoming: Set<DocumentId>
unresolved: Set<string>
```

L'indice deve essere derivato dal contenuto e quindi ricostruibile.

## Tag

Riconoscere:

```md
#progetto
#progetto/nebula
```

E i tag in frontmatter.

Evitare falsi positivi dentro code block e inline code.

## Embed

P1:

```md
![[Immagine.png]]
![[Nota]]
![[Lavagna.excalidraw]]
```

La preview può renderizzare immagini e lavagne. L'embed di nota può mostrare una preview limitata e navigabile.

## Rename safe

Quando si rinomina una nota:

1. trovare tutti i backlink;
2. calcolare le sostituzioni possibili;
3. mostrare una conferma `Aggiorna N collegamenti`;
4. applicare modifiche solo ai riferimenti realmente risolti verso quella nota;
5. non sostituire testo casuale che assomiglia al nome del file.

## Parser

Il parser link/tag deve essere indipendente dal renderer HTML, così ricerca, grafo e backlink possono essere aggiornati senza renderizzare ogni nota.

Preferire esecuzione in Web Worker per Vault grandi.


## Commenti ancorati al testo

I commenti si salvano nello stesso file della nota, in un blocco HTML finale `nebula-text-comments:v1`. Il payload contiene un ID, il commento e il testo selezionato, con la posizione e il contesto a sinistra e a destra. L’editor tiene il blocco separato dal contenuto modificabile e dall’anteprima.

Le modifiche in Nebula aggiornano la posizione tramite le transazioni di CodeMirror, incluso Annulla/Ripristina. Alla riapertura, la citazione e il contesto consentono di ritrovare il passaggio. Se il testo è stato eliminato o il contesto è ambiguo, il commento resta nell’elenco della nota, da cui può essere ricollegato a una nuova selezione.


## Pulsanti di testo

In modalità Scrivi, **Elenchi, citazioni e avvisi → Pulsante di testo** e **Inserisci → Pulsante di testo** aprono la creazione di un blocco configurabile. Il tasto destro, Maiusc+F10 e la pressione prolungata aprono la configurazione. Il blocco si salva nella nota come commento Markdown autonomo `nebula-text-button:v1` e resta invisibile nei normali lettori Markdown.

Ogni attivazione inserisce una copia modificabile del testo prima o dopo il blocco. `{{data}}`, `{{data_ora}}`, `{{data_estesa}}` e `{{ora}}` si risolvono all’ora locale del dispositivo nel momento del clic. Annulla rimuove l’intero inserimento.

# Nebula — Search and Indexing

## Obiettivo

Ricerca e backlink devono essere rapidi anche con migliaia di note senza rileggere l'intero Vault a ogni interazione.

## Indice ricostruibile

L'indice non è la fonte di verità. Può essere eliminato e rigenerato dai file.

## Document index

Per ogni documento testuale:

```ts
{
  id,
  path,
  basename,
  extension,
  modifiedAt,
  size,
  title,
  aliases,
  tags,
  headings,
  outgoingLinks,
  unresolvedLinks,
  searchableTextHash
}
```

## Pipeline

1. enumerate files;
2. confronta metadata con cache;
3. leggi solo file nuovi/modificati;
4. parse frontmatter/link/tag/headings;
5. aggiorna inverted index;
6. aggiorna backlink map;
7. notifica UI;
8. persisti cache in IndexedDB.

## Worker

Parsing e indicizzazione devono poter avvenire in Web Worker.

Il main thread riceve progress:

```ts
{ phase: "scan" | "parse" | "index", current, total }
```

## Quick Switcher

`Ctrl/Cmd + O`

Priorità ranking:

1. titolo/basename exact;
2. prefix;
3. fuzzy basename;
4. path;
5. alias;
6. recent usage boost.

## Full-text search

P0:

- parole nel contenuto;
- titolo;
- path;
- alias;
- tag.

P1 syntax:

```text
project nebula
path:Projects
#todo
-tag:archive
```

## Indicizzazione durante editing

Non aggiornare l'indice full-text a ogni pressione tasto.

Aggiornare:

- dopo debounce lungo, oppure
- dopo salvataggio riuscito.

L'autocomplete wikilink usa principalmente l'indice di nomi/alias, che è molto più piccolo.

## Risultati

Ogni risultato mostra:

- titolo;
- breadcrumb path;
- snippet con match;
- tag essenziali;
- data modifica opzionale.

Keyboard:

- ↑ ↓ naviga;
- Enter apre;
- Ctrl/Cmd+Enter apre in nuova tab/split, definire shortcut finale.

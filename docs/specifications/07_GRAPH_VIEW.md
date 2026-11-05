# Nebula — Graph View

## Obiettivo

La vista Grafo deve trasformare la rete di note in uno strumento di navigazione e comprensione, non soltanto in una visualizzazione decorativa.

## Modello dati

```ts
type GraphNode = {
  id: DocumentId;
  path: string;
  label: string;
  folder: string;
  tags: string[];
  outgoingCount: number;
  incomingCount: number;
  type: "note" | "board" | "folder";
};

type GraphEdge = {
  source: DocumentId;
  target: DocumentId;
  kind: "wikilink" | "markdown-link" | "board-link" | "contains";
  directed: boolean;
};
```

La topologia deve derivare dai file reali. Il layer cartelle, richiesto esplicitamente dall’utente, rappresenta soltanto relazioni reali di contenimento cartella→nota e cartella→sottocartella. Non crea collegamenti diretti impliciti fra note sorelle.

## Global Graph — P0

Funzioni:

- pan;
- zoom;
- zoom to fit;
- reset view;
- click nodo → apri documento;
- hover → evidenzia nodo, link e primi vicini;
- click canvas vuoto → deseleziona;
- ricerca nodo;
- hide orphan notes;
- filtro cartella;
- filtro tipo documento;
- toggle label.

## Local Graph — P1

Centro = nota attiva.

Profondità configurabile:

- 1: collegamenti diretti;
- 2: vicini dei vicini;
- 3: massimo consigliato di default.

Il centro deve restare visivamente dominante e stabile.

La BFS locale usa i collegamenti di conoscenza reali. Le cartelle pertinenti vengono aggiunte dopo la visita e non espandono il grafo verso note sorelle non collegate.

## Visual language

- nodi normali: piccoli, neutri;
- nodo attivo: accent violetto;
- nodi direttamente collegati: contrasto alto;
- nodi non correlati durante focus: opacity ridotta;
- arco in uscita/in entrata distinguibile opzionalmente;
- board: forma/icona differente;
- label declutter in base a zoom e importanza.

## Dimensione nodo

Default:

```text
radius = base + log2(1 + degree) * factor
```

Evitare differenze estreme.

## Layout

L'app grafo allegata contiene un layout custom utile come riferimento. Mantenerne i principi migliori:

- calcolo delle dimensioni reali dei nodi;
- distanza minima adattiva;
- repulsione;
- forza dei collegamenti;
- settling controllato;
- possibilità di trascinare e fissare nodi;
- animazione progressiva verso il layout;
- rilevazione/sistemazione overlap;
- impostazioni fisica separate dalla logica React.

### Differenza fondamentale rispetto all'app allegata

L'app allegata usa anche relazioni gerarchiche `parentId/level`. Nebula NON deve assumere una gerarchia di parentela tra note. Le relazioni principali sono gli hyperlink reali.

Il layout Nebula deve quindi trattare il grafo come rete generale. La gerarchia può essere usata solo nel **Local Graph** per definire anelli di profondità rispetto al nodo centrale.

## Strategia layout consigliata

### P0
Usare un force-directed layout con:

- repulsione;
- link distance;
- collision radius;
- center force;
- velocity decay.

### P1
Aggiungere modalità `Adaptive Radial` ispirata all'app allegata:

- nodo centrale = raggio 0;
- depth 1 = primo anello;
- depth 2 = secondo anello;
- ripartizione angolare basata su peso dei sottoinsiemi;
- link trasversali influenzano leggermente l'angolo;
- collision correction finale.

Questa modalità è particolarmente adatta al Local Graph.

## Rendering

Per Vault piccoli/medi SVG è semplice e accessibile.

Per Vault grandi, prevedere progressivamente Canvas/WebGL.

Architettura consigliata:

- modello e layout indipendenti dal renderer;
- `GraphEngine` produce posizioni;
- `GraphRenderer` disegna;
- possibilità di cambiare renderer senza cambiare l'indice.

## Prestazioni

Obiettivi indicativi:

- 1.000 nodi: interazione fluida;
- 5.000 nodi: ancora navigabile con label progressive;
- layout pesante in Web Worker;
- aggiornamento incrementale quando cambia una sola nota;
- non ricostruire tutto il grafo a ogni keystroke.

Il grafo si aggiorna dopo debounce o salvataggio della nota, non per ogni carattere digitato.

## Persistenza posizioni

Due modalità:

1. **Auto**: nessuna posizione persistente obbligatoria.
2. **Pinned/manual**: salvare solo i nodi fissati e la camera.

Storage default: IndexedDB.  
Opzione futura: `.nebula/graph-layout.json` per rendere il layout portabile tra dispositivi.

La camera è salvata come centro in coordinate mondo più scala. Le viste locali usano una chiave separata per ciascuna nota centrale; vengono persistite soltanto le posizioni fissate manualmente.

## Pannello Grafo

Sezioni:

### Filtri
- cartelle;
- tag;
- note/lavagne;
- orfani;
- unresolved opzionali.

### Aspetto
- node size;
- link opacity;
- label density;
- color mode: folder/tag/type.

### Fisica
- repulsion;
- link strength;
- link distance;
- collision distance;
- settling/animation speed.

### Azioni
- re-layout;
- fit;
- release pinned nodes;
- reset settings.

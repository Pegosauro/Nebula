# Nebula — UX/UI Design System

## Direzione visiva

Nebula deve essere moderna, compatta e leggibile. La grafica deve richiamare il nome senza usare sfondi spaziali, stelle o gradienti vistosi come elemento dominante.

Parole chiave:

- grafite;
- ardesia;
- profondità sottile;
- accenti violetto/ciano;
- superfici pulite;
- micro-animazioni morbide;
- bordi poco invasivi;
- densità regolabile.

## Layout desktop consigliato

```text
┌──────────────────────────────────────────────────────────────────────┐
│ App bar / tabs / comandi rapidi                                      │
├──────────┬──────────────────────────────┬────────────────────────────┤
│ Rail     │ Workspace                    │ Context panel              │
│ +        │                              │                            │
│ Explorer │ Editor / Graph / Whiteboard  │ Backlinks / Outline / Info│
│          │                              │                            │
├──────────┴──────────────────────────────┴────────────────────────────┤
│ Status bar                                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### Left activity rail
Icone principali:

1. File
2. Cerca
3. Grafo
4. Lavagne
5. Preferiti/Recenti
6. Impostazioni in fondo

Il rail deve essere stretto e sempre riconoscibile.

### Left sidebar
Pannello contestuale all'icona del rail. Di default mostra File Explorer.

### Workspace centrale
Supporta tab trascinabili e in seguito split panes.

### Right context panel
Mostra contenuto relativo alla vista corrente:

- Editor: Outline, Backlinks, Link in uscita, Proprietà.
- Grafo: filtri e impostazioni layout.
- Lavagna: libreria, proprietà selezione, link a note.

Il pannello destro può essere chiuso completamente.

## Palette proposta

### Dark

```css
--bg-app: #0b0d12;
--bg-panel: #11141b;
--bg-elevated: #171b24;
--bg-hover: #1d2230;
--border: #262c39;
--text-primary: #e8ebf2;
--text-secondary: #9ba3b4;
--text-muted: #6f788c;
--accent: #8b5cf6;
--accent-soft: rgba(139, 92, 246, .18);
--accent-secondary: #22d3ee;
--danger: #ef4444;
--success: #22c55e;
```

### Light

```css
--bg-app: #f5f6f8;
--bg-panel: #ffffff;
--bg-elevated: #ffffff;
--bg-hover: #eef0f5;
--border: #dce0e8;
--text-primary: #20242d;
--text-secondary: #616a7a;
--text-muted: #8a93a3;
--accent: #7657d6;
--accent-soft: rgba(118, 87, 214, .12);
--accent-secondary: #0891b2;
```

La palette deve essere implementata tramite token CSS, non con colori hard-coded nei componenti.

## Tipografia

- UI: `Inter`, `system-ui`, sans-serif.
- Editor: font configurabile; default `ui-monospace`, `SFMono-Regular`, `Cascadia Code`, monospace.
- Titoli: peso 600, non eccessivamente grandi.
- Corpo: 14–16 px a seconda della densità.

Nebula deve funzionare anche senza scaricare font esterni: nessuna dipendenza obbligatoria da CDN.

## Forma dei componenti

- Radius base: 8 px.
- Popover/dialog: 10–12 px.
- Bordi: 1 px.
- Ombre: leggere, solo per elementi flottanti.
- Pulsanti toolbar: prevalentemente icon-only con tooltip.
- Pulsanti primari testuali solo nei flussi che richiedono decisione.

## Micro-interazioni

Durate consigliate:

- hover/focus: 100–140 ms;
- apertura pannello: 160–220 ms;
- tab drag/reorder: animazione fluida 180–240 ms;
- popup: scale 0.98 → 1 con fade breve;
- selezione nodo grafo: 120–180 ms.

Evitare animazioni che rallentano il flusso di lavoro.

## Editor

L'editor deve avere un'area di lettura centrata con larghezza massima configurabile, ma il canvas di lavoro può estendersi quando l'utente usa split view.

Elementi utili:

- breadcrumb sottile sopra il contenuto;
- titolo file editabile;
- stato save discreto;
- conteggio parole opzionale nella status bar;
- pulsante `...` per azioni meno frequenti.

## Tab documenti

- favicon/tipo file a sinistra;
- nome nota;
- pallino dirty se non salvata;
- X solo al passaggio mouse sulla tab inattiva;
- drag & drop con spostamento animato;
- middle-click per chiudere su desktop;
- menu contestuale: Chiudi, Chiudi altri, Chiudi a destra, Duplica vista.

## Command palette

Aspetto simile a un launcher:

- centrata in alto;
- campo grande;
- risultati raggruppati;
- scorciatoia mostrata a destra;
- navigabile completamente da tastiera.

## Grafo

Il grafo deve essere più leggibile della classica “nuvola di puntini”.

Principi:

- link sottili e poco contrastati;
- nodo attivo molto chiaro;
- vicini del nodo attivo evidenziati;
- resto del grafo attenuato;
- label mostrate in base allo zoom e all'importanza;
- pannello filtri separato dal canvas;
- layout fluido ma non instabile.

## Mobile / narrow layout

Non tentare di mostrare tre pannelli contemporaneamente.

- rail inferiore o compatto;
- un solo pannello laterale in overlay;
- workspace a piena larghezza;
- tab orizzontali scrollabili;
- gesture e target minimi 40–44 px.

Le limitazioni del file-system sui browser mobile devono essere gestite a livello prodotto, non nascoste dalla UI.

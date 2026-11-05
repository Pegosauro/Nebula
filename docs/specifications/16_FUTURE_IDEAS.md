# Nebula — Idee future

Queste idee NON appartengono automaticamente allo scope 1.0.

## Funzioni molto utili dopo la base

### Hover preview dei link
Passando su `[[Nota]]` appare una card con anteprima, backlink count e azioni rapide.

### Daily Notes
Template giornaliero opzionale con calendario minimale.

### Templates
Cartella template configurabile e comando `Inserisci template`.

### Note properties editor
Pannello form per modificare frontmatter senza editare YAML manualmente.

### Link suggestions
Pannello che suggerisce note potenzialmente correlate sulla base di titoli/tag/parole comuni, senza modificare i file automaticamente.

### Unlinked mentions
Mostrare testo che cita il titolo di una nota senza wikilink e offrire conversione manuale.

### Graph timelines
Filtro temporale per created/modified date, con animazione opzionale.

### Workspaces
Salvare gruppi di tab/pannelli/layout come workspace nominati.

### Snapshots locali
Prima di operazioni massive (rename con aggiornamento link) creare snapshot temporaneo o copia di sicurezza configurabile.

### Git awareness
Se il Vault è in un repository Git, mostrare soltanto stato file se ottenibile senza backend/browser extension. Non rendere Git un requisito.

### Mermaid
Rendering locale di blocchi Mermaid, lazy-loaded.

### Math
KaTeX locale per formule.

### Command blocks
Azioni rapide da callout speciali, sempre senza eseguire codice arbitrario.

### Plugin architecture
Solo dopo stabilizzazione dell'API interna. I plugin non devono avere accesso illimitato al filesystem per default.

## AI locale/opzionale

Possibile fase futura:

- riassunti;
- suggerimenti di link;
- ricerca semantica;
- query sul Vault.

Vincoli:

- completamente opt-in;
- indicare chiaramente se i dati lasciano il dispositivo;
- possibilità di provider locale;
- nessuna AI necessaria per usare Nebula.

## Mobile companion

A causa delle differenze di supporto del File System Access API, una futura modalità mobile può usare:

- OPFS;
- import/export di Vault;
- provider file esterno;
- sincronizzazione scelta dall'utente.

Non mascherare questa modalità come accesso diretto alla cartella quando non lo è.

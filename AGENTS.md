# Nebula

Leggi [le regole operative del progetto](docs/specifications/12_CODEX_IMPLEMENTATION_RULES.md) prima di modificare il codice.

## Popup con testo selezionabile

Ogni volta che crei o modifichi un popup con testo selezionabile, prova nel browser a iniziare una selezione al suo interno, trascinare il puntatore oltre il bordo e rilasciare. Il popup deve restare aperto e la selezione deve poter essere copiata. Verifica anche la chiusura con un nuovo clic esterno, Esc o il pulsante di chiusura, dove già previsti.

Riusa `useBackdropDismiss` per i dialog che si chiudono dal fondale e `usePopupSelection` per le anteprime che si chiudono quando il mouse si allontana. Non impedire la selezione nativa del browser.

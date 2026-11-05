# Modelli 0.11.0 — controlli

## Scope

Creazione da modello con titolo/cartella, tre modelli iniziali e salvataggio della bozza come modello personale nel Vault. Nessuna modifica alla modalità Lettura o ai metadati strutturati.

## Verifiche automatiche

- Modelli iniziali: compilazione del titolo e data locale, rimozione dei token previsti.
- Modelli personali: scoperta nella cartella Modelli, immagini Markdown riutilizzabili, esempi di codice preservati, blocco dei percorsi fuori dal Vault.
- Filesystem: scrittura iniziale completa, collisioni senza sovrascrittura, conservazione della sorgente, pulizia del file parziale dopo errore.
- Dialoghi React: selezione del modello, cartella, creazione, errori recuperabili, lettura fallita bloccante e copia della bozza corrente.
- Suite esistente, typecheck e build PWA.

## Limiti dell’ambiente di verifica

La suite Playwright è predisposta con un Vault reale in Origin Private File System, isolato dai file dell’utente, per creazione, copia personale, riapertura e collisioni su desktop/narrow. Non è stata eseguita: il Chromium richiesto non è installato e il download disponibile non restituisce un archivio valido.

Il browser collegato non può aprire il server locale (ERR_BLOCKED_BY_CLIENT). Pertanto la verifica visiva dei nuovi dialoghi, dei temi e dei layout 1280/1920 px non è stata completata in questo ambiente. Il rendering dei dialoghi è coperto dai test React in jsdom, che non verificano il layout.

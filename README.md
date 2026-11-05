# Nebula

PWA locale per note Markdown, collegamenti e configuratori tecnici. Versione **0.31.0**.

## Uso quotidiano

1. Apri Nebula e collega una cartella con **Apri Vault** in un browser desktop compatibile con File System Access API.
2. Usa **File** per note e documenti, **Cerca** per la ricerca, **Configuratori** per progetti, regole e distinte.
3. Le note sono file `.md`; i configuratori sono file `.config.json`. I contenuti restano nella cartella scelta e si salvano automaticamente. Gli errori e i conflitti richiedono attenzione prima di chiudere il documento.

Il Vault diretto richiede un browser compatibile. La disposizione per schermi piccoli non sostituisce il supporto alle API del filesystem.

## Configuratore 0.26.0 e Vault di prova

- **Apri Vault di prova**, in benvenuto e Impostazioni, crea file di esempio nell’archivio locale del browser (OPFS), separato dalle cartelle personali. La riapertura conserva i file già presenti. La copia [ZIP](public/samples/Nebula-Vault-Test.zip) si può estrarre e aprire come normale cartella desktop.
- Il campione contiene 31 file: note collegate, 24 schede tecniche e tre configuratori. Pergola dimostrativa usa domini finiti; Misure libere verifica numeri senza passo; Diagnostica intenzionale contiene errori di definizione dichiarati.
- Scelte, vista, filtri del grafo e zoom sono ricordati localmente per Vault e progetto, anche dopo la riapertura dell’app. **Azzera scelte** li rimuove esplicitamente per la configurazione corrente. I file del progetto non vengono modificati da queste preferenze.
- Catalogo con ricerca e filtri per famiglia, gruppo, regola e misura. I comandi secondari sono nel menu ⋯; il riordino viene disabilitato con filtri attivi per proteggere gli elementi nascosti.
- Distinta a colonne con codice, descrizione, misura per pezzo, quantità e stato distinti; ricerca, ordine e raggruppamento per famiglia/gruppo. La ricerca della vista non filtra l’esportazione CSV, che mantiene la distinta completa delle scelte.
- Validazione immediata di parametri e componenti; dipendenze nominate prima della cancellazione. X/Esc chiedono conferma quando si scarta una bozza; Annulla scarta esplicitamente.
- Scheda componente con riepilogo, dati, misura per pezzo e regola/quantità. Le azioni avanzate si espandono; le condizioni E/O/NON mantengono la propria struttura.
- Prova delle condizioni sulle scelte correnti: Vera, Falsa o In attesa, con frase leggibile e parametri ancora da scegliere. Grafo con zoom, adattamento alla finestra, ricerca componenti e selezione multipla esplicita.

Percorso verificabile: TELO Sì prima del MODELLO → MODELLO TELO → Larghezza 300 cm → PR001 con misura 299 cm e quantità 2 pz. Dettagli: [guida del configuratore](docs/CONFIGURATOR_GUIDE.md).

## Interfaccia 0.25.0

- **Pannelli contestuali:** nessun pannello vuoto nella schermata di benvenuto; Inizio non mostra l'ispettore di un documento precedente. L'ispettore segue il documento attivo o il grafo.
- **Disposizioni separate:** visibilità dei pannelli ricordata localmente per note, grafo, configuratori e altre aree. Le Impostazioni sospendono i pannelli senza cancellarne la disposizione. Le preferenze iniziali valgono nelle aree non personalizzate.
- **Navigazione:** icone con suggerimenti completi oppure nomi estesi su desktop. Usa le doppie frecce in basso o Impostazioni → Layout → Nomi nella navigazione. Negli schermi stretti le destinazioni restano raggiungibili nella barra scorrevole.
- **Configuratore:** Utilizzo contiene Esplora, BOM e Grafo; Definizione contiene Parametri e Componenti; Controlli contiene Analisi. Ogni vista resta accessibile con un clic. La BOM continua a chiudere l'ispettore quando la selezioni.
- **Salvataggio:** barra di stato con Salvato nel Vault, Modifiche in attesa, Salvataggio, Non salvato o Conflitto sul file. Il Configuratore usa gli stessi testi. L'assenza di connessione è un'informazione separata.
- **Leggibilità:** marchio sempre intero, controlli delle impostazioni coerenti, testi secondari più contrastati e densità compatta che riduce gli spazi senza rimpicciolire i testi.

## Avvio e verifica

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run test:e2e` esegue gli scenari browser configurati quando l'ambiente dispone del browser e del server previsti da Playwright. La build produce `dist/` e include il service worker PWA. Quando un aggiornamento è pronto, usa il banner dell'app per applicarlo dopo aver salvato il lavoro.

## Documentazione

- [Architettura corrente](docs/ARCHITECTURE.md)
- [Guida del configuratore](docs/CONFIGURATOR_GUIDE.md)
- [Dettagli e storia delle funzionalità](docs/FEATURE_HISTORY.md)
- [Cronologia delle release](CHANGELOG.md)
- [Verifiche](docs/QA_REPORT.md)

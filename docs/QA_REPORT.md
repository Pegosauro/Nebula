# Prova browser 0.26.0–0.26.1

Ambiente: Chrome cloud, viewport 1363 × 936, sito Nebula esistente. Prova eseguita attraverso l’interfaccia con il Vault OPFS popolato; nessuna iniezione di dati nella pagina.

- Apertura del Vault: 31 file, 28 note e tre configuratori, usando gli adapter reali.
- TELO Sì selezionato prima di MODELLO; poi MODELLO TELO, Larghezza e Sporgenza 300: PR001/PR002 da 299 cm, 2 pz. Distinta completa anche con LED No, Bianco e Addossata.
- Passaggio alla nota Pergola campione e ritorno: BOM e valori conservati.
- Ricerca catalogo PR001: 1/24 risultati; apertura della scheda con riepilogo 2 pz e 299 cm. Codice PR002 duplicato segnalato, bozza annullata.
- Grafo: Adatta alla finestra, ricerca PR001, evidenziazione del componente e selezione multipla attiva. Tema chiaro e scuro ispezionati.
- Ricaricamento dell’app: Vault ripristinato automaticamente; preferenze della vista conservate nel browser.
- Nessun errore applicativo osservato nei log acquisiti; i messaggi presenti provengono dall’estensione del browser.
- Regola annidata di PR006 aperta dal menu di riga: frase leggibile e risultato Vera con le scelte correnti; chiusura con Annulla senza scrittura.
- Due test aggiuntivi sul cambio al Vault di prova verificano il salvataggio di ogni nota per il proprio percorso e la conservazione del Vault personale e dei buffer quando una scrittura fallisce.
- Rifiniture 0.26.1: contrasto dei pulsanti del configuratore in scuro e indicazione visiva della selezione multipla.
- Limiti: non eseguiti i progetti Playwright locali, viewport 1280/1920 o dispositivi touch reali; restano distinti dalla prova manuale desktop e dai test React/DOM.

# Verifica configuratori 0.26.0

- 303 test Vitest superati in 51 file, inclusi gli scenari preesistenti e 13 nuovi controlli.
- Vault reale di prova generato in `test-vault/`, con la stessa copia ZIP fornita dall’app. I test usano le stesse definizioni serializzate del Vault integrato.
- Caso di riferimento verificato: TELO selezionabile prima del MODELLO; MODELLO TELO e larghezza 300 cm producono PR001 da 299 cm, quantità 2 pz.
- Memoria tra smontaggio/riapertura della vista, ricerca catalogo, filtri con riordino protetto, codici duplicati, valori ripetuti, annullamento e conferma X/Esc, dipendenze prima della cancellazione, BOM Possibile con quantità distinta, raggruppamento, ricerca e adattamento/multiselezione del grafo verificati in React/DOM.
- Creazione dei file di prova confinata alla directory OPFS dedicata; la seconda apertura conserva un file modificato e ricrea soltanto i file mancanti.
- Scenario E2E aggiunto in `e2e/configurator.spec.ts` usando esclusivamente l’interfaccia e il Vault integrato.
- Anteprima browser locale non disponibile tramite il percorso supportato dall’ambiente; nessun browser installato o server alternativo. Verifica visiva prevista sul sito pubblicato, distinta dai risultati automatici elencati sopra.

# Verifica consolidamento 0.25.0

- TypeScript e build Vite/PWA completati.
- 290 test superati in 48 file, compresi i 283 test preesistenti del progetto.
- Nuovi scenari: disposizioni separate note/grafo/configuratore; ritorno dalle Impostazioni; passaggio alla scheda Inizio; preferenze malformate; pannelli negli schermi stretti; visibilità contestuale e destinazioni della navigazione.
- Suite Configuratore esistente superata: regole, BOM, misura per pezzo, grafi, selezionabilità ed esportazioni conservati.
- Preflight browser locale non disponibile in questo ambiente: nessun server alternativo o browser installato. Verifica delle interazioni nei test React/DOM. La verifica visiva sul sito pubblicato è distinta da questi controlli.
- Avviso Vite sulla dimensione del bundle principale: non è un errore di build; nessun intervento speculativo sul caricamento delle dipendenze in questa release.
- Nessuna migrazione dei file del Vault; le nuove preferenze contengono soltanto il layout.

# Verifica editor 0.10.0

TypeScript e build Vite/PWA completati; 93 test superati in 24 file.

- Controlli reali Aspetto della pagina verificati in Scrivi e lettura bloccata: dimensione, larghezza, piena larghezza, preferenze persistite e nessuna modifica al contenuto.
- Apertura dei collegamenti a note e URL con un clic in Scrivi; Alt+clic e trascinamento non avviano la navigazione.
- Anteprima da bozze non salvate, lettura asincrona del Vault, risposta obsoleta ignorata dopo cambio destinazione, chiusura con Esc/resize, note mancanti e link esterni senza letture improprie.
- Estratti sanificati e privi di immagini/controlli attivi.
- Verifica React/CodeMirror con DOM e filesystem simulati; nessun controllo visivo o touch in browser in questa fase.

# Verifica editor 0.9.1

TypeScript e build Vite/PWA completati; 88 test superati in 23 file.

- Tipografia condivisa tra Scrivi e anteprima; colori della sintassi limitati a Sorgente; rimozione dell’evidenziazione della riga attiva.
- Lucchetto nella pagina reale: apertura in sola lettura, barre di modifica nascoste, Sorgente disabilitata, blocco mantenuto tornando alla nota e sblocco verificato.
- Protezione delle operazioni dell’editor: formattazione, inserimento, sostituzione singola/multipla, Undo/Redo, transazioni di digitazione e incolla di immagini. Selezione e aggiornamenti dal disco rimangono possibili; Annulla torna operativo dopo lo sblocco.
- Anteprima bloccata: testo selezionabile privo di delimitatori Markdown, Ctrl/⌘ A circoscritto alla nota, checkbox disabilitate e nessun pulsante di modifica tabella. Attributi HTML contenteditable rimossi.
- Controlli svolti in React/CodeMirror con DOM simulato. Nessuna verifica visiva in browser o su touch richiesta in questa fase.

# Verifica editor 0.9.0

TypeScript e build Vite/PWA completati; 85 test Vitest superati in 23 file.

- Scrivi/Anteprima unificati; modalità Sorgente conservata e preferenze Anteprima migrate.
- Test React/CodeMirror: rivelazione del solo elemento al cursore, selezione senza delimitatori, formattazione e Annulla, ritorno da Sorgente, collegamenti e alias, callout, codice, separatori, tabelle visuali e checkbox reversibili.
- Tabelle modificabili con pulsante o doppio clic; la sostituzione visuale non cambia il file.
- La copia continua a conservare il Markdown; non viene introdotta una conversione implicita degli appunti.
- Verifica in ambiente simulato: nessun test browser visivo, touch o con una cartella reale in questa fase.

# QA Report — 0.8.0

## Editor — verifica corrente

- TypeScript strict: superato.
- Vitest: **23 file, 79 test superati**.
- Build di produzione Vite/PWA: superata, asset e service worker generati.
- Nuove prove di integrazione React/CodeMirror in jsdom: cronologia e selezione tra Scrivi/Sorgente/Anteprima e rimontaggio della nota; formattazione da tastiera; completamento wikilink e comando slash; clipboard Excel; checkbox dell’anteprima; apertura e modifica della tabella.
- Prove sulla trasformazione Markdown: formattazione reversibile, ricerca letterale/parole Unicode, celle TSV multilinea, pipe protetti, posizioni di tabelle/titoli nei file CRLF, esclusione degli esempi di codice, callout/evidenziazione e sanificazione HTML.
- Immagini: risoluzione di percorsi relativi con vincolo al Vault, formato raster, nomi univoci, scrittura e recupero errore/abort con adapter simulato.
- Conflitti: continuare a scrivere non rimuove lo stato di conflitto; autosave e Salva restano bloccati fino alla risoluzione esplicita.
- Rimane un avviso non bloccante sulla dimensione del chunk CodeMirror, caricato separatamente.

### Limiti della verifica

Le prove dell’editor sono eseguite con React/CodeMirror e filesystem simulato, non con una cartella reale del dispositivo. Non attestano selezione nativa del Vault, resa visiva nei diversi browser, touch/mobile, permessi reali, installazione PWA o funzionamento offline end-to-end. Nessuna nuova pubblicazione è stata richiesta in questa fase; viene salvata la nuova versione del progetto esistente.

## Verifica precedente 0.7.7


## Verifiche automatiche

- TypeScript strict;
- Vitest: 21 file e 64 test superati su modello globale, percorsi gerarchici, BFS locale, layout force/radiale, storage, modalità editor, link, ricerca e filesystem;
- build Vite/PWA produzione;
- worker indice e worker grafo prodotti come asset separati.

## Graph P1

- i link tra cartelle diverse entrano direttamente nella cartella principale della destinazione e scendono fino alla nota, senza radice né risalita delle cartelle sorgente;
- verificato l’esempio nota 1 → cartella 2 → cartella 2.2 → nota 2, oltre ai link inversi e alle destinazioni nella radice;
- i link nella stessa cartella restano diretti; quelli tra cartelle diverse sono instradati anche nel grafo Locale;
- gerarchie locali complete oltre tre livelli visivi senza cambiare la profondità semantica 1–3;
- layout locale suddiviso per rami, con posizioni finite, nota centrale stabile e pin conservati;
- i segmenti comuni vengono riutilizzati senza introdurre molle duplicate nel layout;
- filtri per cartella e tipo non producono percorsi con nodi mancanti;
- hover e selezione individuano tutti i nodi e i segmenti del percorso interessato;
- profondità locale 1–3 calcolata con BFS sui link reali;
- cartelle pertinenti visibili senza espansione implicita verso note sorelle;
- centro locale stabile a coordinate mondo `(0, 0)`;
- anelli progressivi e posizioni finite;
- pin manuali rispettati dal Force Layout e dall’Adaptive Radial;
- il centro locale ignora eventuali posizioni manuali;
- camera, pin e preferenze isolati per Vault in IndexedDB;
- rilascio dei pin e relayout non modificano la topologia.

## Controlli conservativi

- le note con contenuto entrano in Anteprima a ogni apertura, mentre quelle vuote entrano in Scrivi;
- la modalità non cambia automaticamente durante la digitazione nella nota corrente;
- l’estensione Markdown è rimossa solo dalla presentazione, non dai path usati per leggere e salvare i file;
- i parametri della fisica restano chiusi per impostazione predefinita e sono accessibili tramite il sotto-menu nativo;
- il worker invia frame progressivi e annulla le simulazioni superate quando cambiano i parametri;
- il thread UI disegna l’ultimo frame disponibile senza eseguire la simulazione pesante;
- il Vault locale resta l’unica fonte primaria;
- IndexedDB conserva soltanto stato derivato e preferenze;
- nessuna simulazione globale pesante viene avviata dal Canvas sul thread UI;
- le risposte worker superate non sostituiscono il layout corrente;
- un nodo non più presente viene escluso dai pin prima del layout;
- un errore del grafo resta confinato dall’error boundary e non coinvolge i buffer dell’editor.

## QA browser

Il browser QA non è stato eseguito perché non richiesto. L’ambiente Sites non avvia il preview supervisionato durante i normali interventi. Verifica manuale consigliata: selezione singola/multipla e multilinea in Scrivi, focus attivo/inattivo nei due temi; grafo Locale ramificato con cartelle annidate, filtri e pin.

## Dimensioni multiple — 0.27.0 (2026-10-16)

- 312 test in 52 file superati; controllo TypeScript superato.
- Nuovi test: misure indipendenti, conversioni per asse, risultati parziali e varianti, vincoli del grafo, quantità sommate senza alterare le misure, nomi personalizzati e duplicati, validazione del secondo asse, dipendenze e CSV numerico.
- Interazioni React/jsdom: aggiunta/rimozione, correzione vuota bloccante, Applica/Annulla, salvataggio e riapertura, due dimensioni nella BOM e nel pannello del grafo, conservazione delle misure legacy.
- Campione AC019 nel Vault di prova e nello ZIP: Larghezza 300 e Sporgenza 300 producono L 298 × H 297 cm, quantità 1 pz. I file di prova già presenti non vengono sovrascritti.
- Nessuna verifica visiva del nuovo editor in un browser reale: control-browser non disponibile; non sono stati avviati server o browser alternativi. Le verifiche di layout responsive, touch e resa grafica restano da eseguire.

## Parametri di testo e proprietà — 0.28.0 (2026-10-16)

- 322 test in 53 file superati.
- Verificati: stringhe libere, proprietà facoltative senza bloccare l’enumerazione, conservazione di misure/quantità, aggregazione delle proprietà tra varianti, uguaglianza/disuguaglianza e vincoli di testo, propagazione dei valori richiesti, percorsi e contraddizioni del grafo.
- Verificati formato 7, lettura dei file precedenti, riferimenti mancanti o di tipo errato, nomi duplicati, avvisi sulle dipendenze e colonne CSV con virgolette, separatori, testo Unicode e ritorni a capo.
- React/jsdom: creazione del parametro Testo, aggiunta/eliminazione/annullamento delle proprietà, salvataggio e riapertura, selezioni ricordate, passaggio BOM/Esplora/Grafo, campi vuoti facoltativi e rendering del testo come contenuto senza interpretazione HTML.
- Il campione AC019 espone Materiale collegato al parametro Materiale telo. Le copie di prova già esistenti non vengono sovrascritte.
- Verifica visiva in browser reale non disponibile: control-browser assente. Nessun controllo visivo desktop/mobile/touch è attestato per questa modifica.

## Opzioni di testo e valore autonomo — 0.29.0 (2026-10-16)

- Suite completa: 328 test in 53 file superati. Dopo l’ultimo controllo dei filtri delle opzioni, rieseguiti e superati anche i 50 test di integrazione del configuratore. Build TypeScript/Vite/PWA superata.
- Opzioni testuali aperte/chiuse: creazione, validazione di elenco vuoto e duplicati, spunta persistita, pulsanti BOM, elenco Esplora, testo libero con suggerimenti e rimozione di scelte personalizzate diventate non ammesse.
- I testi usati soltanto come proprietà non vengono disabilitati in base alla loro assenza nelle varianti quantitative. Le liste chiuse usate nelle condizioni sono enumerabili.
- Valore del componente: persistenza, indipendenza dalle scelte BOM, valori locali fuori dall’elenco generale, quantità e misure conservate, resa nel pannello del grafo e CSV, ritorno al valore BOM, blocco del valore locale vuoto e Annulla.
- Formato 8 validato; comportamento libero dei vecchi testi conservato. Campione AC019 collegato alla BOM e AC020 autonomo aggiornato nello ZIP.
- Verifica visiva in browser reale non disponibile; nessuna attestazione di layout desktop/mobile/touch per questa modifica.

## Duplicazione del componente — 0.30.0 (2026-10-19)

- Suite completa: 335 test in 54 file superati; build TypeScript/Vite/PWA riuscita.
- Duplicazione di dati, dimensioni, proprietà con valore autonomo e scheda collegata; nuovi identificativi e codici univoci anche con differenze di maiuscole/spazi.
- Verificati alberi annidati, condizioni comuni, alternative additive, rami disattivati, esclusioni, componenti richiesti e alternativi, lettura/salvataggio e componenti senza regole.
- Regole condivise: verificato che la copia non aumenti quantità di altri componenti e che la modifica della quantità copiata lasci inalterati gli originali.
- React/jsdom: azione nel menu ⋯, apertura e rinomina della copia, modifica della sua regola, salvataggio e riapertura, risultato BOM e catalogo filtrato senza perdita delle righe nascoste.
- Browser reale non verificato: control-browser non disponibile. Nessuna verifica visiva o touch attestata per questa modifica.

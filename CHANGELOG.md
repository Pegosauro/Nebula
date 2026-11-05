# Changelog

## 0.37.0 — Titoli modificabili e duplicazione note

- Titolo modificabile direttamente nella nota aperta, con Invio o clic fuori per confermare ed Esc per annullare. Nome del file, scheda e albero aggiornati insieme.
- Azione Duplica nota nel menu dell’albero: copia completa nella stessa cartella, nome libero e apertura immediata, anche dalle modifiche non ancora salvate.
- Errori di nome e collisioni mostrati vicino al titolo; modifica disabilitata nelle note bloccate.
- Metadati delle sessioni aggiornati dopo rinomina e spostamento per consentire il salvataggio successivo senza falsi conflitti.

## 0.36.0 — Ricerca rapida e scrittura senza simboli

- Ricerca rapida con worker dedicato a nomi, titoli e alias, richieste accorpate, cache e risultati limitati senza ordinare tutto il Vault.
- Rimossi i due pulsanti dei pannelli dalla barra superiore; il pannello destro si riapre dalla linguetta Dettagli o con Ctrl/⌘ Alt I.
- In Scrivi, il cursore e la cancellazione saltano i delimitatori Markdown nascosti e conservano la formattazione del testo rimanente.
- Rimossi la sfocatura del popup di ricerca e i cambi di altezza durante la ricerca.

## 0.31.0 — Rimozione delle sezioni Grafo e Lavagne

- Rimosse le due destinazioni principali, i pannelli e i riferimenti in Inizio e Impostazioni.
- Eliminati codice, renderer, worker e stili del grafo delle note; rimane il grafo del configuratore.
- I layout delle sezioni rimosse vengono ignorati. Note, collegamenti, ricerca e configuratori restano disponibili.
- I file Excalidraw già presenti sono allegati generici e rimangono nel Vault.

## 0.30.0 — Duplica componente

- Azione Duplica nel menu ⋯ del catalogo, con apertura immediata della scheda della copia.
- Codice univoco, inserimento dopo l’originale e copia di famiglia, gruppo, unità, scheda collegata, misure e proprietà.
- Regole e condizioni copiate con nuovi identificativi, incluse alternative e stati disattivati.
- Le azioni di aggiunta/esclusione degli altri componenti nelle regole condivise non vengono duplicate; dipendenze e riferimenti ai parametri rimangono collegati al catalogo.

## 0.29.0 — Opzioni di testo e valori del componente

- Opzioni predefinite nei parametri Testo e spunta Consenti testo personalizzato per la BOM e per Esplora.
- Elenchi chiusi validati; opzioni testuali finite usate nelle regole enumerabili senza testo libero.
- Proprietà con origine Dalla BOM oppure Valore del componente: il valore locale può differire dalle opzioni generali e non cambia la selezione globale.
- Valori autonomi conservati nel riepilogo, nella BOM, nel grafo e nel CSV.
- Formato 8, con comportamento libero conservato per i testi dei file precedenti.

## 0.28.0 — Parametri di testo e proprietà

- Nuovo tipo Testo, con campo libero in Esplora e nelle opzioni BOM e memoria delle scelte.
- Proprietà dei componenti collegate ai parametri di testo tramite righe compatte Nome / Parametro.
- Valori in distinta sotto la descrizione, nel riepilogo e nel pannello del grafo; colonne dedicate nel CSV.
- Il testo usato solo come proprietà è facoltativo e non blocca le varianti; uguaglianza e disuguaglianza disponibili nelle regole.
- Validazione dei riferimenti e dei nomi, dipendenze prima della cancellazione e formato configuratore 7 compatibile in lettura con i file precedenti.
- Proprietà Materiale sul telo del Vault di prova aggiornato.

## 0.27.1 — Distinta per famiglia

- BOM suddivisa automaticamente per famiglia, con sezioni richiudibili e conteggio dei componenti visibili.
- Famiglie senza corrispondenze nascoste durante la ricerca; ricerca e ordinamento conservati.

## 0.27.0 — Dimensioni dei componenti

- Editor Dimensioni compatto con righe per nome, parametro, correzione e unità; nomi predefiniti e personalizzati.
- Calcolo indipendente di ogni dimensione in distinta, varianti, grafo e riepilogo.
- CSV con dimensioni numeriche separate; compatibilità con le misure singole esistenti.
- Formato configuratore 6 per le nuove dimensioni; nessuna migrazione automatica dei file precedenti.
- Telo a due dimensioni nel Vault di prova scaricabile.

## 0.26.1 — Rifinitura dopo la prova browser

- Prima di passare al Vault di prova vengono salvate tutte le note aperte; un errore mantiene il Vault corrente e i buffer.

- Pulsanti secondari del configuratore coerenti con il tema scuro anche quando privi della classe button-secondary.
- Stato attivo della selezione multipla del grafo visibile oltre all’indicazione ARIA.
- Verifica nel browser del Vault popolato: ripristino della cartella, memoria tra viste, ricerca catalogo, codice duplicato e caso 300 cm → 299 cm / 2 pz.


## 0.26.0 — Configuratori e Vault popolato

- Vault di prova locale OPFS con 31 file, copia ZIP e inizializzazione che preserva i file esistenti.
- Preferenze per progetto: vista, scelte e stato del grafo ricordati tra aperture.
- Catalogo ricercabile/filtrabile; azioni di riga raccolte nel menu; riordino protetto durante i filtri.
- BOM con colonne separate, ricerca, ordinamento e raggruppamento per gerarchia del catalogo.
- Validazioni inline; dipendenze prima della cancellazione e conferma dello scarto con X/Esc.
- Scheda componente organizzata, riepilogo e opzioni avanzate delle azioni richiudibili.
- Regole leggibili e prova delle condizioni sulle scelte correnti; grafo con zoom, fit, ricerca e selezione multipla esplicita.
- Formati del Vault e motore delle condizioni conservati; confronto codici duplicati coerente con gli spazi esterni ignorati.


## 0.25.0 — Consolidamento dell'interfaccia

- Pannelli pertinenti alla vista e disposizioni separate ricordate localmente; dettagli collegati alla scheda attiva.
- Navigazione desktop compatta o estesa, senza nomi troncati; tutte le destinazioni disponibili nella barra degli schermi piccoli.
- Marchio leggibile con pannelli chiusi, contrasto dei testi secondari e controlli delle impostazioni uniformati.
- Configuratore organizzato in Utilizzo, Definizione e Controlli; risultati ed esportazioni separati dal coordinamento della vista.
- Stato di salvataggio locale esplicito nella barra della shell e nell'intestazione del Configuratore.
- README sintetico, dettagli storici conservati in docs/FEATURE_HISTORY.md e architettura aggiornata.
- Nessuna modifica ai formati Markdown/configuratore o al motore di calcolo.


## 0.24.0 — Misura per pezzo dei componenti (2026-10-15)

- Misura facoltativa nei componenti, calcolata da un parametro numerico con correzione positiva o negativa.
- Conversione automatica mm/cm/m e quantità indipendenti: gli accessori mantengono solo il conteggio.
- Misura per pezzo in BOM compatta, pannello del grafo ed esportazione CSV, con formula nei dettagli.
- Valori mancanti o diversi tra varianti indicati come Da definire; combinazioni con misure negative escluse.
- Formato configuratore 5, compatibilità in lettura con i precedenti e conservazione del formato nelle modifiche successive.

## 0.23.2 — Distinta BOM compatta (2026-10-15)

- Righe più basse con codice, descrizione e quantità affiancati; unità accanto al numero.
- Rimossi il sottotitolo ripetuto e la scritta «Perché questo componente?», sostituita dall’icona informazioni.
- Famiglia, gruppo, regole e scheda tecnica nei dettagli richiudibili della riga.
- Testi lunghi a capo, stati parziali riconoscibili e area touch del comando conservata.

## 0.23.1 — Scelte aperte prima dei parametri vincolanti (2026-10-15)

- Opzioni condizionate selezionabili finché i parametri da cui dipendono non sono definiti.
- Blocco applicato solo quando la condizione risulta falsa; cancellando il parametro vincolante le opzioni tornano disponibili.
- Disponibilità coerente in BOM ed Esplora, mantenendo la verifica dei vincoli nelle combinazioni complete.

## 0.23.0 — Selezionabilità dei valori dei parametri (2026-10-15)

- Condizioni «Selezionabile solo se» associate a ogni singolo valore, configurabili dai parametri con E/O/NON annidati.
- Opzioni disabilitate in BOM ed Esplora finché il requisito non è vero, compresi i parametri ancora non scelti.
- Valori non condizionati indipendenti, disattivazione e rimozione delle condizioni, supporto allo zero numerico.
- Verifica delle condizioni nelle varianti e nei risultati del grafo; mantenimento delle regole generali e dei componenti.
- Condizioni salvate dentro al parametro nel formato 4, con lettura dei formati precedenti e protezione da declassamenti nelle modifiche successive.

## 0.22.0 — Vincoli dei parametri e pulsanti adattivi (2026-10-15)

- Pulsanti BOM proporzionati al testo, affiancati con ritorno a capo nello spazio della colonna opzioni.
- Vincoli accessibili dall’icona del parametro e dai suoi dettagli, con riepilogo ed evidenziazione delle regole attive.
- Condizioni concatenate E/O/NON e azioni Richiedi valore o Escludi valore tra parametri.
- Riapertura delle regole salvate, associazioni persistenti nel file locale, accesso ai vincoli già esistenti e annullamento delle modifiche.
- Validazione delle azioni e delle associazioni; le combinazioni di Esplora, BOM e risultati del grafo rispettano i vincoli.

## 0.21.2 — BOM a due colonne (2026-10-15)

- Opzioni in elenco verticale a sinistra e distinta dei componenti sulla destra.
- Chiusura automatica del pannello contestuale a ogni apertura della BOM, mantenendo le scelte impostate.
- Colonne disposte in verticale sugli schermi piccoli.

## 0.21.1 — Opzioni rapide nella BOM (2026-10-15)

- Pulsanti per selezionare e deselezionare i valori dei parametri direttamente nella BOM, sopra la distinta a larghezza completa.
- Scelte attive evidenziate, incompatibilità riconoscibili e possibilità di deselezionare sempre un valore attivo.
- Numeri con intervallo e passo selezionabili da pulsanti, mantenendo campo numerico e cancellazione; supporto corretto dello zero.
- Espansione delle liste lunghe senza perdere visibilità o focus sulla scelta selezionata.
- Aggiornamento di distinta e pannello destro, scelte condivise con Esplora e pulsanti utilizzabili durante il ricalcolo nel worker.

## 0.21.0 — Distinta contestuale e regole dal grafo (2026-10-15)

- Informazioni del progetto, schede tecniche e note collegate spostate sotto al grafo in sezioni richiudibili.
- Pannello destro dedicato ai componenti della configurazione corrente, con quantità, unità, stato certo/possibile e ordine per famiglie e gruppi.
- Lista aggiornata dalle scelte di Esplora, dai parametri e dai percorsi selezionati nel grafo, rispettando disuguaglianze e confronti numerici.
- Doppio clic o F2 su un componente apre la regola unica completa nello stesso editor dei componenti. Applica/Annulla conservano la vista e la selezione del grafo.
- Anteprime di calcolo separate dai dati del Vault; risultati obsoleti esclusi e calcoli sospesi durante la modifica della regola.

## 0.20.1 — Percorsi indipendenti dai parametri (2026-10-15)

- Cliccando un valore, inclusi anche i percorsi senza vincoli su quel parametro; la selezione multipla con Ctrl/⌘ rispetta tutti gli altri parametri scelti.
- Grafo compatto con collegamenti diretti che saltano i nodi Qualsiasi valore e partenza Sempre per i percorsi senza condizioni.
- Comando Mostra passaggi senza vincoli per ripristinare la vista completa senza perdere filtro, identità o colori dei percorsi.
- La selezione esplicita di Qualsiasi valore continua a isolare le sole alternative prive di vincolo. Regole e dati del configuratore restano invariati.

## 0.20.0 — Famiglie e percorsi del configuratore (2026-10-13)

- Riepilogo compatto delle regole abilitate sul tasto del componente, al passaggio del mouse o con clic destro. Condizioni e quantità leggibili senza aprire l’editor.
- Ctrl/⌘ + clic seleziona più nodi e riduce il grafo ai percorsi completi comuni, mantenendo colori e nodi condivisi.
- Componenti organizzati in famiglie e gruppi, con assegnazione di un intero gruppo a una famiglia.
- Famiglie e gruppi comprimibili e riordinabili tramite mouse, touch e tastiera; ordine ed espansione persistiti nel Vault.
- Il grafo mostra intestazioni e componenti nell’ordine del catalogo.

## 0.16.3 — Scorrimento unico nel configuratore (2026-10-02)

- Eliminato il contenitore scorrevole annidato: le viste del configuratore usano lo scorrimento dell’area di lavoro principale.
- Contenuti accessibili delle liste contenuti nella superficie del configuratore, evitando overflow sul contenitore esterno.


## 0.16.2 — Componenti condizionati riconoscibili (2026-10-01)

- Icona Aggiungi regola evidenziata in viola quando il componente è coinvolto in una regola attiva con condizioni. Tooltip e descrizione accessibile riportano il numero di regole.


## 0.16.1 — Regole direttamente dal componente (2026-10-01)

- Comando discreto sulla riga e nei dettagli del componente per aggiungere una regola.
- Editor delle condizioni condiviso con Regole, componente preselezionato e quantità iniziale 1.
- Salvataggio congiunto delle bozze di componente e regola; annullamento della regola torna ai dettagli conservando il componente in bozza.


## 0.16.0 — Liste compatte e riordino del configuratore (2026-10-01)

- Parametri, componenti e regole in righe riepilogative con dettagli in popup.
- Bozze isolate con Applica/Annulla: annullare non modifica il catalogo né aggiunge elementi incompleti.
- Drag&drop di componenti e regole con indicatore di inserimento, supporto touch e frecce accessibili. Ordine persistito nel Vault senza cambiare identificativi o vincoli.
- Compilazione stabile e risultati aggiornati tornando a Esplora, BOM o Analisi.


## 0.15.1 — Compilazione stabile del configuratore (2026-10-01)

- Nessun calcolo delle varianti durante la modifica di Parametri, Componenti o Regole; i risultati vengono ricalcolati riaprendo Esplora, BOM o Analisi.
- Eliminato il messaggio che compariva sopra i campi a ogni carattere, mantenendo stabile il modulo.
- Spazio fisso per lo stato del salvataggio e per gli aggiornamenti delle viste di risultato.
- Verificati mantenimento del focus, identità dei campi, salvataggio delle modifiche e ricalcolo dopo la compilazione.

## 0.15.0 — Configuratori tecnici nel Vault (2026-10-01)

- Nuovo modulo Configuratori, creazione vuota o da esempio, file `.config.json` nel Vault e schede integrate.
- Editor visuali di parametri, componenti, gruppi, schede tecniche, condizioni E/OPPURE, inclusioni, esclusioni, vincoli, alternative e quantità calcolate.
- Propagazione delle scelte obbligate, esplorazione progressiva, BOM con tracciabilità delle regole, varianti finite e limite esplicito di 5.000 combinazioni.
- CSV per distinta/varianti, esportazione JSON, grafo dedicato e analisi delle definizioni e dei percorsi validi.
- Navigazione e anteprima dai link delle note, schede tecniche e note collegate nel pannello destro.
- Salvataggi serializzati e protetti da modifiche esterne, chiusura/cambio Vault/rinomina/spostamento con flush delle bozze.
- Guida dedicata e test del motore, filesystem, salvataggi e interazioni React.


## 0.10.1 — Corsivo e chiusura di tutte le note

- corsivo valido anche su selezioni con spazi ai bordi;
- riconoscimento dei delimitatori `_testo_` e rimozione del solo corsivo conservando il grassetto;
- pulsante Corsivo attivo soltanto in presenza di vera enfasi Markdown;
- X rossa nella scheda Inizio con almeno due note aperte;
- conferma prima della chiusura di tutte le schede, con salvataggio delle modifiche;
- errori e conflitti di salvataggio mantengono aperte le note.

## 0.7.7 — Grafo Locale ramificato e selezione leggibile

- percorsi attraverso le cartelle di destinazione anche nel grafo Locale, senza radice né rami di appartenenza non pertinenti;
- profondità 1–3 riferita ai link reali tra note, separata dai livelli visivi di cartelle e sottocartelle;
- layout radiale con settori suddivisi per ogni ramificazione e supporto oltre tre livelli visivi;
- conservati pin, nota centrale, link inversi e animazione progressiva;
- selezione in Scrivi più contrastata nei temi chiaro/scuro, con testo bianco e stato inattivo distinguibile.

## 0.7.6 — Ingresso diretto nella cartella di destinazione

- i link tra cartelle diverse seguono solo la gerarchia della destinazione, dalla sua cartella principale alla nota;
- esclusi dal percorso la radice del Vault e la risalita delle cartelle di origine;
- i link inversi seguono la propria destinazione; quelli verso la radice restano diretti;
- invariati appartenenza tratteggiata, grafo locale, link nella stessa cartella e file Markdown.

## 0.7.5 — Percorsi attraverso le cartelle

- i link tra note in cartelle diverse seguono la gerarchia fino all’antenato comune e alla destinazione nel grafo globale;
- i link nella stessa cartella e nel grafo locale restano diretti;
- appartenenza tratteggiata e link continui paralleli, con evidenziazione dell’intero percorso al passaggio del mouse o alla selezione;
- segmenti condivisi riutilizzati dalla fisica senza molle duplicate o attrazione diretta tra note di cartelle diverse;
- filtri, backlink e file Markdown conservano le relazioni originali; il filtro solo note usa collegamenti diretti.

## 0.7.4 — Fisica del grafo live

### Migliorato

- il Force Layout invia posizioni progressive dal Web Worker mentre la simulazione è in corso;
- i nodi si muovono e si assestano visivamente invece di saltare direttamente al risultato finale;
- ogni modifica ai parametri riavvia subito la simulazione dalle posizioni correnti;
- il layout radiale locale passa alla nuova configurazione con una transizione progressiva;
- le simulazioni superate vengono interrotte quando cambia rapidamente un parametro.

## 0.7.3 — Controlli fisica comprimibili

### Migliorato

- i parametri della fisica del grafo sono raccolti in un sotto-menu comprimibile;
- la sezione parte chiusa per lasciare più spazio a filtri e dettagli del nodo;
- apertura e chiusura sono accessibili da tastiera e accompagnate da un indicatore visivo;
- il rilascio dei nodi fissati resta sempre raggiungibile fuori dal sotto-menu.

## 0.7.2 — Nomi note senza estensione

### Migliorato

- l’estensione Markdown resta nascosta in Explorer, schede, intestazioni e percorsi visualizzati;
- ricerca, Quick Switcher, backlink, autocomplete e dettagli del grafo mostrano nomi puliti;
- rinomina, eliminazione e creazione delle note non espongono l’estensione tecnica;
- i percorsi reali dei file restano invariati per conservare compatibilità e sicurezza dei collegamenti.

## 0.7.1 — Anteprima predefinita

### Migliorato

- ogni nota con contenuto si apre in modalità Anteprima quando viene selezionata;
- le note appena create, vuote o composte solo da spazi si aprono in modalità Scrivi;
- la scelta manuale della modalità resta stabile mentre si modifica la nota corrente.

## 0.7.0 — Local Graph e layout adattivo

### Aggiunto

- modalità Local Graph centrata sulla nota Markdown attiva;
- profondità configurabile 1–3 calcolata con BFS sui collegamenti reali;
- cartelle pertinenti mantenute nel grafo locale senza espandere note sorelle non collegate;
- layout Adaptive Radial con centro stabile, anelli progressivi e settori proporzionali alle diramazioni;
- Web Worker dedicato ai layout globali e locali per non bloccare l’interfaccia;
- pannello fisica per repulsione, forza e distanza dei collegamenti, collisione, stabilizzazione e velocità;
- trascinamento dei nodi con fissaggio manuale e comando per rilasciare tutti i pin;
- persistenza IndexedDB di camera e posizioni fissate, separata per Vault e modalità;
- persistenza delle preferenze fisiche, della profondità locale e della visibilità etichette.

### Affidabilità

- la topologia resta derivata dai file del Vault e non viene mai salvata come fonte primaria;
- il nodo centrale del Local Graph non può essere spostato accidentalmente;
- i layout superati vengono ignorati quando cambia rapidamente modalità o configurazione;
- le posizioni fissate riferite a nodi non più presenti vengono eliminate dal layout attivo.

## 0.6.0 — Global Graph

### Aggiunto

- modello di nodi e archi derivato dall’indice dei wikilink risolti;
- force layout deterministico con repulsione campionata per reti grandi, link force, collisione e settling;
- renderer Canvas imperativo separato dal rendering React;
- pan, zoom, fit, reset vista e ricalcolo del layout;
- hover con attenuazione dei nodi non correlati e risalto dei primi vicini;
- click su nodo per aprire la nota Markdown reale;
- ricerca dei nodi per titolo e percorso;
- filtri per cartella, note isolate e visibilità delle etichette;
- label progressive in base a zoom, grado e focus;
- navigazione tastiera con frecce, Invio ed Escape;
- pannello di selezione con conteggi backlink e link in uscita.

### Architettura e confini

- il grafo è caricato in chunk separati dalla shell e dall’editor;
- l’engine mantiene le posizioni transitorie fuori dallo stato React;
- nessuna topologia viene salvata come fonte primaria;
- Local Graph, adaptive radial, physics inspector, pin e persistenza camera restano assegnati alla Fase 6.

## 0.5.0 — Ricerca locale e Quick Switcher

### Aggiunto

- indice full-text nello stesso Web Worker usato dal modello dei collegamenti;
- ricerca per titolo, basename, percorso, alias, tag e contenuto;
- ranking distinto per ricerca completa e apertura rapida;
- snippet contestuali e stato di avanzamento dell’indicizzazione;
- Search Panel con navigazione da tastiera;
- Quick Switcher tramite `Ctrl/Cmd+O`, frecce e Invio;
- boost locale delle note aperte di recente;
- cache IndexedDB versionata per riutilizzare i documenti non modificati.

### Affidabilità e performance

- il Vault resta l’unica fonte primaria e la cache può essere ricostruita integralmente;
- una scansione confronta dimensione e data di modifica prima di rileggere il contenuto;
- salvataggi, rinomine, spostamenti ed eliminazioni aggiornano indice e cache in modo incrementale;
- le richieste superate non possono sostituire risultati di una query più recente;
- nessuna ricerca o indicizzazione globale viene eseguita a ogni pressione nell’editor.

## 0.4.0 — Wikilink e knowledge model

### Aggiunto

- parser wikilink indipendente dal renderer Markdown;
- risoluzione per path, basename, confronto case-insensitive e alias da frontmatter;
- autocomplete `[[` basato sulle note reali del Vault;
- apertura dei wikilink dalla preview e con `Ctrl/Cmd+click` nell'editor;
- pannelli backlink e link in uscita con stati resolved, unresolved e ambiguous;
- selezione esplicita della destinazione quando più note corrispondono;
- creazione di note e cartelle mancanti da un collegamento unresolved;
- Web Worker dedicato all'indice dei collegamenti e aggiornamento incrementale dopo il salvataggio.

### Sicurezza dati

- i link ambigui non aprono mai una nota scelta casualmente;
- l'indice è derivato dai file e può essere ricostruito senza diventare fonte primaria;
- il parsing globale non viene eseguito durante la digitazione;
- la riscrittura automatica dei link dopo rinomina resta differita alla Fase 8 come previsto dalla roadmap.

## 0.3.0 — Editor Markdown

### Aggiunto

- CodeMirror 6 con sintassi Markdown, numeri di riga, cronologia e supporto Tab;
- lettura e scrittura diretta delle note `.md` nel Vault;
- sessioni documento indipendenti, dirty state e indicatore nelle tab;
- autosalvataggio debounced e comando `Ctrl/Cmd+S`;
- preview Markdown sanificata con DOMPurify;
- conteggio parole e caratteri nella status bar;
- controllo modifiche esterne al focus della PWA;
- risoluzione conflitti tramite `Ricarica da disco` o `Mantieni Nebula`;
- avviso prima della chiusura della pagina con modifiche non salvate.

### Sicurezza dati

- un fallimento di scrittura mantiene intatto il buffer in memoria;
- il cambio scheda non sostituisce una bozza non salvata;
- il salvataggio verifica dimensione e data del file prima di scrivere;
- immagini e HTML eseguibile sono bloccati nella preview di questa fase.

## 0.2.0 — Vault locale

### Aggiunto

- creazione di note Markdown e cartelle dall'Explorer;
- rinomina e spostamento conservativi con copia e verifica;
- eliminazione con conferma e chiusura dei riferimenti aperti;
- gestione collisioni, nomi non validi e principali errori filesystem;
- Vault recenti persistiti in IndexedDB e riapertura con controllo permessi;
- menu azioni per file e cartelle, dialoghi accessibili e feedback operazioni;
- aggiornamento immediato di Explorer, tab e pannello contestuale.

### Sicurezza dati

- l'originale viene rimosso solo dopo la verifica della copia;
- un errore di copia mantiene intatto l'originale;
- nessuna operazione può risolvere percorsi esterni al Vault.

## 0.1.0 — Foundation

### Aggiunto

- progetto React 19, TypeScript e Vite;
- design token dark/light e densità UI;
- shell responsive con Activity Rail, Explorer, tab, workspace, contesto e status bar;
- routing interno e store separati;
- preferenze locali versionate e pagina Informazioni;
- PWA installabile con cache dell'app shell e aggiornamento su conferma;
- adapter File System Access e repository handle IndexedDB;
- ripristino Vault, gestione permessi e scansione ricorsiva non distruttiva;
- test unitari, integrazione storage e base E2E.

### Vincoli

- nessun file viene ancora letto nell'editor o modificato;
- ricerca, grafo, wikilink e lavagne restano moduli predisposti secondo roadmap.

# Funzionalità e aggiornamenti fino alla 0.24.0

Il contenuto seguente conserva la guida storica, con i dettagli delle funzionalità introdotte nelle versioni precedenti. Per avvio e comportamento corrente vedi il [README](../README.md).

# Nebula

Nebula è una PWA local-first per note Markdown, collegamenti e lavagne. La versione `0.24.0` integra configuratori tecnici con parametri, catalogo componenti, regole visuali, esplorazione delle varianti, distinta, grafo dedicato e analisi. I configuratori sono file locali `.config.json` del Vault; le note restano `.md`.

## Esportazione pagina in PDF (0.19.0)

Il comando **PDF** nella barra della pagina prepara il contenuto Markdown corrente, anche non ancora salvato, con impaginazione A4 chiara, tabelle unite e immagini del Vault. Nella stampa del dispositivo scegli **Salva come PDF** (su mobile usa il comando PDF/condivisione della stampa). Tutto avviene localmente; il file della nota resta invariato. Le immagini non disponibili sono segnalate nel documento.

## Configuratori tecnici (0.24.0)

I parametri si riordinano con drag&drop (anche touch), frecce o Alt + frecce. L’ordine è salvato nel Vault e usato in Esplora e nel grafo. Nel grafo clicca una voce per evidenziare i percorsi completi precedenti e successivi; le altre strade diventano grigie. «Mostra tutti i percorsi», un secondo clic o Esc ripristinano la vista. I confronti uguali mostrano solo il valore; ≠ e il valore negato sono rossi. I confronti numerici mantengono gli operatori.

Il codice del componente resta in evidenza; la descrizione è grigia e leggermente più piccola. Il grafo segue i parametri nell’ordine di inserimento, con percorsi alternativi fino ai componenti. E/O/NON sono sviluppati in percorsi equivalenti; le voci uguali nella stessa colonna si condividono anche quando arrivano da percorsi differenti; ogni percorso mantiene la propria identità e il proprio colore. Le linee indicano stato e tipo di vincolo, e i dettagli mantengono l’espressione completa. Il grafo è limitato a 64 alternative per regola e 256 percorsi complessivi, segnalando eventuali tagli; il calcolo delle configurazioni resta completo entro i suoi limiti.


**Regole annidate**: combina gruppi E, O e NON nel popup. Colori, rientri e collegamenti rendono visibile ogni ambito; i gruppi si comprimono e l’espressione completa resta leggibile sotto l’albero. NON nega una condizione o un gruppo, lasciando in attesa i valori non scelti. I file precedenti conservano il comportamento; le espressioni si salvano nel formato versione 2.

**Regole del componente** compare direttamente nella scheda: riaprendo il componente ritrovi le sue regole, il riepilogo delle condizioni e lo stato. Il componente ha una sola regola: quando è già presente, il comando diventa **Modifica regola** e riapre le condizioni salvate. Non crea una nuova bozza. Apri la regola da lì per modificarla; Applica aggiorna la stessa regola e salva anche il componente. Le regole condivise restano sincronizzate tra le schede. La tab Regole è rimossa; i vincoli senza componente sono disponibili in Componenti → Vincoli generali.

Una piccola icona sulla riga del componente e **Aggiungi regola** nella scheda aprono il popup delle condizioni con il componente già selezionato. Se il componente è ancora in bozza, Applica salva insieme componente e regola; Annulla torna ai dettagli senza perdere la bozza.

I componenti sono separati per **Famiglia → Gruppo / assieme**, con una sola intestazione per gruppo e righe su un unico livello; unità e scheda collegata restano a fianco del codice e della descrizione. I componenti senza gruppo sono in **Senza gruppo**. Il riordino dei componenti avviene all’interno del gruppo; l’assegnazione si modifica nei dettagli.

Parametri, componenti e regole sono presentati in liste compatte. Clicca una riga o la matita per aprire i dettagli: **Applica** conferma le modifiche e **Annulla** scarta la bozza. Componenti e regole si riordinano trascinando la maniglia (anche su touch) oppure usando le frecce; l’ordine viene salvato nel Vault.

Apri **Configuratori** dalla barra laterale, crea un progetto vuoto o con esempio e compila Parametri e Componenti. **Esplora** accetta scelte parziali e distingue componenti certi e possibili. La BOM e le varianti si esportano in CSV; il progetto si salva automaticamente nel Vault ed è collegabile dalle note. La ricerca dichiara esplicitamente domini numerici liberi e il limite di 5.000 combinazioni.

La compilazione delle definizioni mantiene fermo il modulo; i calcoli delle varianti partono nelle viste Esplora, BOM e Analisi.

Guida completa: [docs/CONFIGURATOR_GUIDE.md](CONFIGURATOR_GUIDE.md).

## Tabelle e pagina centrata (0.14.0)

- `attachments` non compare nell’albero delle cartelle, anche se annidata. I file restano nel Vault e i riferimenti alle immagini continuano a funzionare; i contatori dell’albero includono solo le voci visibili.
- **Modifica tabella**: usa i selettori nelle celle e Shift+clic, oppure **Selezione multipla**, per scegliere un rettangolo. **Unisci celle** unisce in orizzontale e verticale; **Dividi celle** ripristina le celle. Intestazioni e corpo si selezionano separatamente. L’unione conserva i testi originali; modificando il testo unito, il nuovo contenuto resta nella prima cella.
- Trascina i separatori sopra le colonne oppure compila **Larghezza colonna in pixel** (80–1200 px). I separatori supportano anche le frecce della tastiera. **Larghezze automatiche** ripristina il comportamento standard. Una cella unita occupa la somma delle colonne coinvolte; tabelle più larghe della pagina scorrono al loro interno.
- Unioni e larghezze si salvano nello stesso `.md` in un commento `<!-- nebula-table:… -->` immediatamente sotto la tabella. Il commento è incluso nel widget della tabella in Scrivi e resta invisibile in lettura; Sorgente mostra il file completo. La tabella standard conserva tutti i valori ed è leggibile anche fuori da Nebula, dove i lettori Markdown senza questa estensione mostrano le celle separate.
- **Applica modifiche** inserisce tabella e impostazioni come una singola modifica annullabile; chiudere il dialogo non cambia la nota. Le impostazioni vengono ripristinate alla riapertura e sono rispettate nella lettura bloccata.
- Scrivi rispetta la larghezza scelta in **Aspetto della pagina** e i margini automatici: la regola di espansione di CodeMirror non allarga più la pagina. Font, temi e modalità a tutta larghezza sono conservati.

## Correzioni 0.13.1

- I commenti identificativi `<!-- nebula-quick-note:… -->` non compaiono più in **Scrivi**, anche quando il cursore è vicino al commento. Restano disponibili in **Sorgente** e nel file locale per distinguere gli appunti, convertirli e riconoscere i tentativi ripetuti di salvataggio. Nessuna migrazione o cancellazione dei dati esistenti.
- La lettura nasconde gli stessi identificativi anche dopo un blocco di codice lasciato aperto da un appunto precedente. Gli esempi di codice con un semplice commento letterale restano leggibili.
- Il corsivo può usare la variante inclinata disponibile del font o, se assente, la sintesi dello stile, che lo stile globale dell’interfaccia bloccava. La correzione è limitata al testo in corsivo delle note/anteprime e vale in Scrivi, lettura bloccata e temi chiaro/scuro.
- `*parola*` e `_parola_` sono entrambe valide. Il pulsante Corsivo usa gli asterischi; gli spazi devono rimanere all’esterno dei delimitatori (`*parola* `, non `* parola *`).

## Trasformare un appunto (0.13.0)

- Apri **Appunti veloci** e il pannello richiudibile **Organizza appunti**. Ogni appunto riconosciuto mostra data, testo e azioni **Crea nota** / **Crea procedura**.
- Scegli titolo, tipo e cartella nel dialogo. La nuova nota si apre subito; l’originale resta nel foglio. I nomi già presenti non vengono sovrascritti e il dialogo conserva il testo dopo un errore.
- La procedura è il modello tecnico da compilare, con il testo e la data originali nella sezione **Appunto di partenza**. Non vengono inventati passaggi.
- La copia usa il testo corrente del foglio, comprese le modifiche non ancora salvate. Immagini e collegamenti Markdown locali rimangono validi nella cartella di destinazione; token e titoli dell’appunto restano letterali.
- Il pannello è disponibile solo nel foglio di radice **Appunti veloci.md**. Le date esistenti sono riconosciute; i commenti identificativi distinguono anche appunti con data identica. Nessun nuovo backend.

## Proprietà e appunti veloci 0.12.0

- **Proprietà** apre il pannello facoltativo di una nota: tipo, categoria libera, stato, revisione e tag separati da virgole. È chiuso di default; la X lo nasconde interamente. La scelta per nota resta durante la sessione; la preferenza iniziale è in Impostazioni → Editor.
- Aprire o nascondere il pannello non modifica il file. I valori compilati vengono salvati nel frontmatter YAML dello stesso `.md`, con l’autosalvataggio normale. I campi di testo si confermano uscendo dal campo o con Invio. Campi vuoti rimossi; note libere senza proprietà restano Markdown semplice.
- Scrivi e lettura nascondono il frontmatter, anche quando il pannello è chiuso. Sorgente permette di modificarlo direttamente. Il lucchetto rende anche le proprietà non modificabili. Alias, chiavi esterne e corpo della nota sono preservati; valori YAML avanzati/duplicati vanno modificati in Sorgente.
- Il pulsante **Nota veloce** nell’intestazione è disponibile da File, ricerca, grafi, lavagne, recenti e Impostazioni. In Concentrazione è presente anche nell’intestazione dell’editor. Serve un Vault collegato.
- Ogni clic apre un editor essenziale completamente vuoto. **Aggiungi appunto** aggiunge il testo in fondo al file reale **Appunti veloci.md** nella radice del Vault, preceduto da data e ora locali (con secondi). Il file viene creato al primo appunto, e quelli precedenti restano nello stesso foglio in ordine cronologico.
- Dopo il salvataggio resti nella schermata corrente; **Apri foglio** consente di leggere e modificare il foglio. Un errore mantiene l’editor veloce e il testo. Chiudere un appunto compilato richiede la scelta esplicita di scartarlo.
- Prima di aggiungere una cattura, Nebula salva eventuali modifiche manuali nel foglio. Un conflitto resta bloccante. Durante la breve scrittura soltanto l’editor del foglio viene protetto dalle modifiche; la versione su disco viene riletta e la scrittura verifica i metadati.
- Un identificativo in commento Markdown invisibile in lettura evita duplicazioni quando si ripete lo stesso tentativo dopo una scrittura riuscita ma non confermata. Non è una copia dei dati: tutti gli appunti sono nel file locale.

## Modelli 0.11.0

- **Nuovo** nell’Explorer e nella pagina Inizio apre la creazione di una nota libera o da modello, con titolo e cartella di destinazione.
- Modelli iniziali: **Procedura tecnica**, **Problema e soluzione**, **Appunto tecnico**. L’anteprima mostra la struttura prima della creazione; dalla 0.12.0 tipo, stato e revisione vengono compilati nel frontmatter, con categoria/tag facoltativi nel pannello. I modelli già esistenti non sono convertiti automaticamente.
- Il pulsante **Modello** nell’intestazione di una nota apre **Salva come modello**. Include il contenuto corrente, anche se non ancora salvato, senza sostituire la nota originale.
- I modelli personali sono file `.md` reali direttamente nella cartella **Modelli** del Vault. Sono disponibili dopo la riapertura e possono essere modificati, rinominati o eliminati dall’Explorer. Una cartella già presente con questo nome viene riutilizzata; non viene sovrascritto alcun file esistente.
- `{{titolo}}` e `{{data}}` vengono compilati durante la creazione, con titolo della nuova nota e data locale. Il titolo principale della copia personale viene reso riutilizzabile automaticamente; per aggiornare anche date nel testo usare esplicitamente `{{data}}` nel modello.
- Le immagini e i riferimenti Markdown locali sono convertiti in percorsi dalla radice del Vault, così funzionano anche creando note in altre cartelle. Gli esempi di codice non sono alterati. Gli allegati restano condivisi nel Vault, senza duplicazione.
- Nessun backend, nuova dipendenza o invio di contenuti in rete. Errori di lettura, scrittura, nomi e collisioni restano visibili nel dialogo, mantenendo i valori inseriti.

Quando sono aperte almeno due note, la X rossa nella scheda **Inizio** permette di chiuderle tutte dopo conferma. Le modifiche vengono salvate prima della chiusura; in caso di errore o conflitto le schede restano aperte.

In entrambi i grafi, i link tra cartelle diverse partono dalla nota sorgente, entrano direttamente nella cartella principale della destinazione e scendono fino alla nota collegata. Esempio: `nota 1 → cartella 2 → cartella 2.2 → nota 2`. La radice del Vault e le cartelle di origine sono escluse dal percorso del link. I link nella stessa cartella e verso note nella radice restano diretti. Le linee tratteggiate indicano appartenenza; una traccia continua parallela indica i link. Passando su un nodo o selezionandolo da tastiera si evidenziano i percorsi completi. Il filtro solo note mantiene link diretti quando le cartelle sono nascoste. File Markdown, backlink e conteggi dei link reali non cambiano.

Il grafo Locale mostra soltanto le cartelle attraversate dai link, senza ramificazioni di appartenenza non pertinenti. La profondità 1–3 continua a contare i collegamenti tra note; tutti i passaggi nelle cartelle vengono aggiunti senza consumare questo limite. Il layout suddivide progressivamente i settori di ogni ramo e supporta più di tre livelli visivi, mantenendo centro, pin e animazione.

In Scrivi, la selezione principale usa uno sfondo blu contrastato e testo bianco in entrambi i temi. La selezione non attiva resta visibile con una tonalità distinta; il livello CodeMirror conserva anche le selezioni multiple.

## Editor 0.10.0

- Due modalità: **Scrivi**, con anteprima integrata e simboli visibili solo sull’elemento al cursore; **Sorgente**, con tutti i simboli Markdown e numeri di riga. Durante la selezione il testo rimane formattato, senza delimitatori. Le precedenti preferenze Anteprima diventano Scrivi.
- **Aspetto della pagina**: dimensione del testo 14–24 px, larghezza 560–1200 px oppure tutta la larghezza disponibile. Preferenze locali ricordate, applicate anche a Scrivi, Sorgente e lettura bloccata, senza modificare il file Markdown.
- Anteprima al passaggio del mouse sui link a note, anche durante la scrittura: mostra la bozza se già aperta oppure legge il file locale. Gestione note mancanti, destinazioni ambigue ed errori; nessuna anteprima remota dei siti esterni.
- Un clic apre i collegamenti in Scrivi; Alt+clic consente la modifica. Il trascinamento per selezionare testo non apre il link.
- Tipografia e link coerenti tra Scrivi e lettura, nessuna evidenziazione della riga del cursore, colori della sintassi solo in Sorgente.
- Lucchetto per mostrare la pagina resa in sola lettura: selezione/copia native, niente modifiche, checklist e tabelle disabilitate. Il blocco si conserva per nota durante la sessione.
- Barra compatta e barra sulla selezione; pulsanti attivi, comandi Annulla/Ripristina e scorciatoie.
- Menu **Inserisci**, ricercabile, e completamento `/` a inizio riga. Guida ricercabile con esempi e comandi.
- Selettore note per nome/percorso/alias e creazione di una nota nella cartella della nota corrente senza cambiare scheda; completamento `[[` con percorso completo e parentesi finali.
- Collegamenti esterni http/https/email aperti in una nuova scheda; incollare un URL sopra una selezione crea un link.
- Inserimento immagini da file, trascinamento, appunti, percorso locale o URL. I file raster importati sono salvati in `attachments/` con nomi univoci e riferimenti relativi. PNG/JPG/GIF/WebP/AVIF/BMP, massimo 20 MB per file; SVG attivi non ammessi. I riferimenti locali non possono uscire dal Vault. Gli URL esterni necessitano della rete.
- Checklist cliccabili in Scrivi, con aggiornamento del Markdown e annullamento condiviso.
- Tabelle: griglia di modifica, intestazioni, allineamento colonne, inserimento/rimozione righe e colonne, Tab tra celle e incolla di intervalli Excel. In Scrivi, “Modifica tabella” o doppio clic su una cella aprono la griglia; in Scrivi/Sorgente il pulsante Tabella modifica quella sotto il cursore o ne inserisce una nuova.
- Evidenziatore `==testo==` e riquadri `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` in Scrivi. Codice e HTML attivo restano separati dal testo eseguibile.
- Trova e sostituisci nella nota, ricerca letterale, maiuscole e parola intera; “Sostituisci tutto” è un’unica operazione annullabile.
- Indice titoli navigabile, conteggi parole/caratteri e modalità Concentrazione.
- Stato CodeMirror conservato tra modalità e schede (cronologia, selezione e scorrimento). La cronologia è della sessione, non un backup persistente dopo la chiusura dell’app.
- Un conflitto esterno resta bloccante anche continuando a digitare, fino alla scelta esplicita “Ricarica da disco” o “Mantieni Nebula”.

La guida completa è in [docs/EDITOR_GUIDE.md](EDITOR_GUIDE.md).

## Requisiti

- Node.js 20.19+;
- Edge o Chrome desktop per l'accesso diretto a una cartella tramite File System Access API;
- contesto sicuro (`https` o `localhost`) per le API PWA e filesystem.

## Avvio

```bash
npm install
npm run dev
```

## Verifiche

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Stato della versione 0.10.0

- shell responsive desktop/narrow;
- tema Sistema/Chiaro/Scuro senza dipendenze CDN;
- Activity Rail, Explorer, tab, workspace, pannello contestuale e status bar;
- preferenze locali versionate;
- manifest e service worker PWA con aggiornamento su conferma;
- selezione Vault, persistenza handle in IndexedDB, Vault recenti, gestione permessi e scansione ricorsiva;
- creazione di note `.md` e cartelle;
- rinomina e spostamento tramite copia, verifica e rimozione conservativa dell'originale;
- eliminazione con conferma esplicita;
- controllo collisioni, nomi non validi e path traversal;
- aggiornamento immediato dell'Explorer dopo ogni operazione;
- editor CodeMirror 6 caricato solo quando si apre una nota;
- apertura predefinita in Scrivi, configurabile nelle Impostazioni; modalità e cronologia conservate per nota durante la sessione;
- nomi e percorsi delle note mostrati senza l’estensione Markdown;
- lettura e scrittura UTF-8 dei file `.md` reali;
- autosalvataggio debounced e salvataggio manuale con `Ctrl/Cmd+S`;
- buffer separati per scheda, dirty state e protezione da errori di scrittura;
- rilevamento modifiche esterne e risoluzione esplicita dei conflitti;
- anteprima Markdown sanificata e priva di contenuti eseguibili;
- parser indipendente per `[[Nota]]`, `[[Cartella/Nota]]`, alias visuali e heading preparatori;
- alias delle note ricavati dal frontmatter YAML;
- autocomplete dei wikilink nell'editor;
- navigazione con un clic in Scrivi, `Ctrl/Cmd+click` in Sorgente o `Ctrl/Cmd+Invio` nell’editor;
- backlink, link in uscita, unresolved e ambiguità nel pannello contestuale;
- creazione confermata di note e cartelle mancanti da un link unresolved;
- indice incrementale eseguito in Web Worker e aggiornato dopo un salvataggio riuscito.
- indice di ricerca condiviso nello stesso Web Worker, senza scansioni durante la digitazione;
- ricerca per titolo, percorso, alias, tag e contenuto Markdown;
- risultati ordinati con priorità a titolo e basename e snippet contestuali;
- Quick Switcher con `Ctrl/Cmd+O`, navigazione da tastiera e boost delle note recenti;
- cache dell’indice in IndexedDB, derivata e ricostruibile dai file reali del Vault;
- lettura incrementale dei soli file cambiati quando metadati e cache coincidono.
- Global Graph costruito dall’indice dei wikilink risolti e dalla struttura reale delle cartelle;
- force layout deterministico con repulsione, forza dei link, collisione e settling progressivo;
- renderer Canvas indipendente da React e feature caricata in modo lazy;
- pan, zoom puntuale, zoom da toolbar, fit, reset vista e ricalcolo layout;
- hover con focus su nodo, archi e primi vicini;
- click sul nodo per aprire la nota reale nel workspace;
- ricerca nodo, filtro cartella, esclusione note isolate e label progressive;
- selezione e navigazione tastiera sul canvas.
- Local Graph centrato sulla nota attiva con profondità BFS 1–3;
- layout Adaptive Radial con anelli, spaziatura proporzionale e centro stabile;
- layout pesanti calcolati in un Web Worker dedicato;
- pannello fisica con repulsione, forza e distanza link, collisione, settling e velocità;
- parametri della fisica nascosti in un sotto-menu comprimibile e accessibile;
- simulazione live con aggiornamento progressivo delle posizioni durante l’assestamento;
- trascinamento dei nodi per fissarne manualmente la posizione;
- persistenza IndexedDB di camera, nodi fissati e preferenze del grafo per ciascun Vault;
- cartelle rappresentate come nodi distinti e collegate a note e sottocartelle reali.

Le specifiche ufficiali originali sono conservate in `docs/specifications/`.

L’icona **Aggiungi regola** si evidenzia in viola quando il componente è coinvolto in almeno una regola attiva con condizioni. Il suggerimento al passaggio del mouse indica quante regole lo condizionano. Le regole disattivate e quelle senza condizioni non attivano l’evidenziazione.

Le viste del configuratore e la raccolta dei progetti utilizzano una sola barra di scorrimento verticale nell’area di lavoro. I dettagli nei popup mantengono lo scorrimento interno quando necessario.


## Regola unica del componente (0.19.0)

Il comando sulla riga e nella scheda riapre sempre la stessa regola con la concatenazione E/O/NON. L’associazione al componente resta salvata anche quando l’azione diventa un vincolo sui parametri. Le vecchie regole multiple sono raccolte in una sola regola e sostituite nel file quando premi Applica. Se hanno azioni identiche e condizioni dimostrabilmente incompatibili, diventano un’unica espressione O; altrimenti le rispettive condizioni, azioni, quantità e stati restano alternative esplicite della regola unica. Quando si attivano insieme, i contributi continuano a sommarsi. Annulla non modifica i dati.

Le regole condivise restano uniche anche per gli altri componenti collegati, mantenendo i loro effetti. Le modifiche da Vincoli generali rispettano lo stesso vincolo di unicità. I nuovi salvataggi di regole associate ai componenti usano il formato versione 3, leggibile da Nebula 0.19.0; i file precedenti restano supportati.

## Famiglie, riepilogo regole e percorsi selezionati (0.20.0)

Nei dettagli di un componente, **Famiglia** crea o assegna una categoria come PROFILI o ACCESSORI. Il pulsante con la cartella nell’intestazione di un gruppo assegna tutti i suoi componenti a una famiglia. I gruppi omonimi in famiglie diverse restano separati. Maniglie, touch, frecce e Alt + frecce riordinano le famiglie, i gruppi nella famiglia e i componenti nel gruppo. Clicca un’intestazione per espandere o comprimere la sezione. Ordine e stato aperto/chiuso si salvano nel file; gli identificativi e le regole restano invariati.

Passa il mouse sul tasto della regola, oppure usa il clic destro, per vedere un elenco numerato delle condizioni e delle azioni abilitate del componente, comprese le quantità. Le alternative disattivate sono escluse. Il clic destro mantiene aperto il riepilogo fino a Chiudi, Esc o un clic esterno; il clic sinistro apre l’editor della regola esistente.

Nel grafo, **Ctrl + clic** sui parametri (⌘ su Mac, oppure Ctrl + Invio/Spazio da tastiera) mantiene solo i percorsi completi compatibili con tutte le voci selezionate, compresi quelli senza vincoli sui parametri scelti e nasconde le altre diramazioni. I colori rimangono stabili e i nodi uguali restano condivisi. Un secondo Ctrl + clic o la × sul parametro rimuove una selezione; **Mostra tutti i percorsi** o Esc ripristina il grafo. Il filtro cambia soltanto la vista. I componenti e le intestazioni nel grafo rispettano l’ordine delle famiglie e dei gruppi del catalogo, anche quando le sezioni del catalogo sono chiuse.

## Percorsi senza vincoli nel grafo (0.20.1)

Selezionando **LED = Sì**, il grafo evidenzia sia i percorsi che richiedono Sì sia quelli che non vincolano il LED. Con **Ctrl/⌘ + clic**, ogni scelta ammette il proprio valore oppure un passaggio senza vincoli, continuando a rispettare tutte le altre scelte. Le alternative incompatibili restano escluse dal filtro. Il valore scelto è l’unico evidenziato come selezionato; “Qualsiasi valore” viene incluso come assenza di vincolo, senza diventare una seconda scelta.

La vista compatta salta i passaggi “Qualsiasi valore” e collega direttamente le condizioni effettive fino al componente. Un percorso senza condizioni parte da **Sempre**. Attiva **Mostra passaggi senza vincoli**, accanto ai comandi del grafo, per visualizzare nuovamente tutti i nodi intermedi. Se scegli esplicitamente “Qualsiasi valore” nella vista estesa, il filtro mostra soltanto i percorsi che non vincolano quel parametro. Colori, identità delle regole, ordine delle famiglie e dei gruppi e dati della configurazione sono preservati.

## Distinta nel pannello del configuratore (0.21.0)

Il pannello destro mostra i **componenti della configurazione corrente** con codice, descrizione, quantità, unità e stato **Certo / Possibile**, nell’ordine di famiglie e gruppi. Parte dalle scelte di Esplora e si aggiorna selezionando parametri o percorsi nel grafo. Una scelta nel grafo sostituisce soltanto il relativo parametro; gli altri restano validi. I confronti ≠ e numerici filtrano le varianti ammesse. Senza un numero preciso, le quantità dipendenti da quel numero restano **Da definire**. In caso di scelte incompatibili, il pannello segnala la configurazione non valida e non presenta una distinta come valida. Il calcolo continua nel worker locale, con i limiti già indicati.

Nel grafo, **Dati del progetto**, **Schede tecniche** e **Note collegate** sono sotto al disegno in sezioni richiudibili. Anche il riepilogo della voce o del percorso evidenziato si può comprimere.

**Doppio clic sulla casella del componente** apre direttamente la sua regola unica completa, condividendo lo stesso editor della vista Componenti. **F2** sulla casella selezionata e il comando nel riepilogo del componente offrono la stessa apertura. **Applica** aggiorna la regola; **Annulla** torna al grafo senza modificare i dati. Il clic singolo mantiene l’evidenziazione dei percorsi. La lista a destra conserva la selezione di configurazione mentre apri i dettagli di un componente. Le selezioni del grafo e i risultati calcolati non vengono scritti nel file del Vault.

## Pulsanti delle opzioni nella BOM (0.21.2)

Nella scheda **BOM**, le opzioni sono raggruppate per parametro nella colonna sinistra; ogni pulsante segue la larghezza del testo e va a capo automaticamente, usando lo spazio disponibile; la distinta occupa la colonna destra. Aprendo la BOM, il pannello contestuale destro si chiude automaticamente per liberare spazio. Su schermi piccoli, le due colonne si dispongono una sotto l’altra. Un clic seleziona il valore; un secondo clic sullo stesso pulsante lo deseleziona e riapre tutte le possibilità per quel parametro. Scegliendo un altro valore dello stesso parametro sostituisci il precedente. Le scelte attive hanno un segno di spunta e un bordo evidenziato; le opzioni non compatibili sono attenuate e disabilitate. Una scelta già attiva resta sempre deselezionabile, anche se la configurazione diventa non valida.

Distinta, quantità e pannello destro si aggiornano alle scelte; Esplora e BOM condividono gli stessi valori. **Azzera scelte** rimuove tutti i filtri. I numeri con un intervallo e un passo hanno pulsanti per i valori disponibili, oltre al campo numerico e al comando di cancellazione; i numeri liberi mantengono il campo. Per liste lunghe, **Mostra altre opzioni** e **Comprimi opzioni** regolano l’elenco, mantenendo visibile il valore selezionato. Regole e catalogo nel Vault restano invariati.


## Vincoli dai parametri (0.22.0)

Nella vista **Parametri**, l’icona discreta delle regole apre i **Vincoli del parametro**; lo stesso elenco è disponibile nei dettagli con **Gestisci vincoli**. L’icona è evidenziata se ci sono vincoli attivi. Sono visibili anche i vincoli già esistenti e quelli condivisi dagli altri parametri coinvolti.

Crea un **Vincolo**: nel blocco **QUANDO** concatena condizioni con **E, O e NON**; in **ALLORA** usa **Escludi valore** o **Richiedi valore**. Per esempio, **LED = Sì → Escludi Telo: Sì**, oppure **Modello = A → Richiedi Motore: Sì**. La presenza è espressa da un valore, come Sì, senza rimuovere la definizione del parametro.

**Applica** salva il parametro e le modifiche ai vincoli; **Annulla** le scarta. Le regole restano riapribili dal parametro e sono salvate nel file locale `.config.json` (formato 3). I vincoli limitano le combinazioni valide in Esplora, BOM e nei risultati del grafo, mantenendo tutte le regole dei componenti.


## Selezionabilità dei singoli valori (0.23.0)

Apri l’icona delle regole di un parametro: la sezione **Selezionabilità dei valori** mostra ogni opzione separatamente. Clicca per esempio **TELO · Sì** e imposta **Selezionabile solo se → MODELLO = TELO**, usando condizioni **E/O/NON** anche annidate. La condizione è salvata dentro al parametro; riaprendolo trovi lo stesso valore e la stessa espressione. Gli altri valori, come No, rimangono indipendenti.

In BOM ed Esplora un’opzione condizionata resta selezionabile quando mancano le scelte richieste: puoi scegliere TELO Sì prima di MODELLO. Si disabilita solo quando la condizione risulta falsa, per esempio dopo aver scelto un MODELLO diverso da TELO. Cancellando MODELLO, l’opzione si riabilita. Il suggerimento spiega il requisito. Le varianti e i risultati del grafo rispettano gli stessi vincoli. Le regole generali e dei componenti rimangono operative. Le nuove condizioni usano il formato configuratore 4, leggibile da Nebula 0.23.0; i file precedenti rimangono supportati.


## Distinta compatta (0.23.2)

La distinta mostra codice, descrizione e quantità con unità su righe compatte. La descrizione resta leggibile e va a capo quando serve. L’icona informazioni apre i dettagli della singola riga: famiglia, gruppo, regole e scheda tecnica. La scritta «Perché questo componente?» e il sottotitolo ripetuto sono stati rimossi. Gli stati Possibile e Da definire restano riconoscibili.


## Misura per pezzo separata dalle quantità (0.24.0)

Nei dettagli di un componente puoi attivare **Misura calcolata per pezzo**, scegliere un parametro numerico, l’unità e una correzione positiva o negativa. Per esempio **Larghezza = 300 cm**, correzione **−1 cm**, produce un componente di **299 cm**; con un parametro in mm e misura in cm la conversione è automatica. Le quantità fisse o calcolate restano nella regola del componente.

BOM, pannello del grafo e CSV mostrano la misura per pezzo separata dalla quantità. Gli accessori senza misura mantengono solo il conteggio. I valori ancora non determinati restano **Da definire**; le misure negative rendono non valida la combinazione che include il componente. La formula è salvata nel componente (formato configuratore 5); i file precedenti rimangono leggibili.

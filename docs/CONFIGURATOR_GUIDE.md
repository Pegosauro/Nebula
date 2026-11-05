# Configuratori Nebula — 0.24.0

## Miglioramenti 0.26.0

### Prova popolata

In benvenuto o Impostazioni usa **Apri Vault di prova**. La cartella dedicata `Nebula-Vault-Test` vive nell’archivio locale del browser: non usa né modifica il Vault personale. I file esistenti non vengono riscritti quando la riapri. Per una copia portatile scarica lo ZIP, estrailo e apri la cartella con Apri Vault. I dati di prova sono anche in `test-vault/`, rigenerabili con `python3 scripts/generate-test-vault.py`.

Il progetto Pergola dimostrativa contiene 24 componenti, due famiglie, quattro gruppi e sette parametri. Il caso di riferimento è TELO Sì prima di scegliere MODELLO; poi MODELLO TELO, Larghezza 300 cm e Sporgenza 300 cm. PR001 e PR002 devono risultare di 299 cm per pezzo, quantità 2 pz. Il file Diagnostica intenzionale serve a provare codici e valori duplicati; non è un progetto valido da esportare per la produzione.

### Memoria delle scelte

Vista, selezioni, selezione multipla del grafo, ricerca grafica e zoom sono preferenze del progetto nel browser, separate per identità del Vault e percorso. Passando a una nota e riaprendo il configuratore le ritrovi. I parametri eliminati e i valori di scelta rimossi vengono ripuliti dallo stato UI; un numero fuori intervallo rimane visibile perché possa essere corretto. Azzera scelte rimuove i valori e la selezione dei percorsi. Il file `.config.json` resta il progetto di regole, non un salvataggio delle preferenze della vista.

### Catalogo e distinta

Cerca per codice/descrizione e filtra il catalogo per famiglia, gruppo, presenza di regola e misura calcolata. Durante il filtro il riordino è disattivato: usa Azzera filtri per riordinare senza coinvolgere in modo ambiguo i componenti nascosti. Il menu ⋯ della riga raccoglie regola, eliminazione, frecce e dettagli; clic sul codice apre direttamente la scheda. La maniglia conserva drag&drop e Alt+frecce.

Nella BOM misura, quantità e Certo/Possibile sono colonne indipendenti. Per un componente Possibile una quantità numerica vale **se incluso**: il relativo stato rimane ben visibile. La distinta è sempre suddivisa per famiglia, con sezioni richiudibili e conteggio delle righe visibili; i componenti senza assegnazione sono raccolti in Senza famiglia. La ricerca nasconde le famiglie vuote. Il CSV continua a esportare l’intera distinta delle scelte, con misura e quantità separate. Ordine Catalogo conserva la gerarchia del catalogo dentro ciascuna famiglia; Codice e Stato ordinano le righe all’interno della famiglia.

### Modifica protetta e regole

I campi non validi indicano subito il problema e disabilitano Applica. La cancellazione mostra le regole, formule e condizioni di selezionabilità coinvolte; procedendo, i riferimenti restano segnalati in Analisi e non vengono eliminati automaticamente. X/Esc chiedono conferma prima di scartare una bozza modificata; Annulla rappresenta lo scarto esplicito.

La scheda distingue Dati del componente, Dimensioni e Regola e quantità. Il riepilogo mostra le quantità delle azioni e la misura con le scelte correnti, quando definita. Nella regola le opzioni avanzate dell’azione sono richiudibili. La frase leggibile accompagna la prova delle condizioni correnti (Vera/Falsa/In attesa); una condizione non ancora determinata non diventa Falsa. L’espressione completa è disponibile in una sezione apribile. La prova delle condizioni non sostituisce la verifica globale di Analisi.

### Grafo

Usa Riduci/Aumenta zoom o Adatta alla finestra per cambiare la dimensione del disegno. Cerca componente evidenzia i percorsi del risultato scelto. Selezione multipla permette di scegliere più parametri anche senza tastiera; Ctrl/⌘ resta disponibile. Come usare il grafo contiene le istruzioni estese. Le preferenze grafiche non cambiano le regole o i limiti del calcolo.


## Navigazione 0.25.0

- **Utilizzo:** Esplora per le scelte parziali, BOM per la distinta compatta e Grafo per i percorsi.
- **Definizione:** Parametri e Componenti, con i rispettivi vincoli e regole.
- **Controlli:** Analisi e numero delle segnalazioni rilevate. La verifica globale continua a richiedere questa vista.

I gruppi organizzano i comandi, senza richiedere clic aggiuntivi. Le scelte restano condivise tra Esplora e BOM. Entrando in BOM si chiude il pannello destro per lasciare spazio alla distinta; la disposizione delle note e del grafo della conoscenza resta indipendente.

L'indicatore in alto distingue file salvato, modifiche in attesa, scrittura in corso ed errore. In caso di errore i valori aperti restano disponibili: risolvi il problema o esporta la bozza prima di ricaricare.


## Iniziare

1. Collega il Vault locale.
2. Apri **Configuratori** dalla barra laterale oppure **Nuovo configuratore** nell'Explorer.
3. Inserisci il nome. Puoi partire vuoto oppure dall'esempio modificabile con modello A/B, LED e staffe.
4. Definisci **Parametri** e **Componenti**, poi aggiungi le regole dalle schede dei componenti. Usa **Esplora** per scegliere il modello o qualsiasi altro parametro, anche senza completare le scelte.

Durante la compilazione di Parametri e Componenti il modulo resta stabile e non avvia la ricerca delle varianti. I risultati vengono aggiornati riaprendo Esplora, BOM o Analisi.

Le sezioni Parametri e Componenti mostrano una lista compatta con nome e riepilogo. Seleziona la riga o la matita per aprire la scheda completa. Anche i pulsanti di aggiunta aprono una bozza nel popup: **Applica** conferma le modifiche, **Annulla**, la croce o **Esc** le scartano.

Nell’elenco Componenti e nelle regole della scheda di un componente, trascina la maniglia per inserire una riga prima o dopo un’altra. Puoi usare anche le frecce su/giù oppure **Alt + freccia su/giù** sulla maniglia. Il trascinamento supporta mouse e touch. Il nuovo ordine viene salvato nel file, mantenendo gli identificativi e i riferimenti delle regole. L’ordine delle regole non introduce una priorità: le inclusioni continuano a sommarsi.

Dopo **Applica** o un riordino, i dati sono salvati automaticamente dopo una breve pausa, direttamente in `Configurators/<nome>.config.json` nel Vault. **Salva** esegue subito il salvataggio. Il formato è JSON strutturato e versionato; non è necessario scrivere codice. I file sono portabili con la cartella del Vault. Il modulo non usa servizi esterni né database sul server. Dopo l'aggiornamento PWA, i suoi moduli sono inclusi nella cache offline.

## Parametri

- **Scelta:** un valore per riga, ad esempio A, B, C.
- **Sì / No:** valore booleano, distinto dalle stringhe "Sì" e "No".
- **Numero:** minimo, massimo e unità facoltativi. Il passo è facoltativo: senza passo, il numero è libero. Per enumerare tutte le varianti, definisci quel valore in Esplora oppure un intervallo minimo/massimo con passo.

I valori fuori intervallo o non conformi al passo vengono segnalati. Il passo parte dal minimo.

## Componenti

Ogni componente ha un identificativo stabile interno e un codice univoco. Sono disponibili descrizione, gruppo/assieme, unità e collegamento a una nota tecnica del Vault. Il gruppo è una classificazione della distinta: non espande automaticamente un sottoassieme.

**Regole del componente** è visibile direttamente nei dettagli ed elenca la regola unica, le condizioni, lo stato e il numero di azioni o alternative. Clicca una regola o la matita per modificarla dalla scheda del componente. Applica aggiorna la stessa regola, salvando anche la bozza del componente; Annulla torna ai dettagli senza cambiare la regola. Le regole esistenti, anche disattivate o condivise con altri componenti, sono mostrate automaticamente. Le modifiche sono sincronizzate nelle schede di tutti i componenti collegati. Per cambiare un componente aggiorna la sua scheda: tutte le regole continuano a riferirsi allo stesso identificativo.

Dalla riga del componente, la piccola icona **Aggiungi regola**, quando non esiste una regola, apre il popup delle condizioni, con azione **Aggiungi componente**, componente già selezionato e quantità iniziale 1. Lo stesso comando è disponibile nei dettagli. Quando una regola esiste, **Modifica regola** la riapre completa: non aggiunge altre regole. Viene proposta una prima condizione sul primo parametro, modificabile; senza parametri la regola vale sempre. Puoi scegliere altre azioni e quantità, nel popup della regola.

Se stai compilando un componente nuovo o modificando i suoi dati, **Applica** nel popup della regola salva insieme componente e regola. **Annulla** torna ai dettagli del componente mantenendo la sua bozza; dalla scorciatoia sulla riga chiude il popup senza creare nulla. La regola resta nella scheda del componente; non è presente una tab Regole separata.

## Regole visuali

Le condizioni e i gruppi possono essere combinati con **E**, **O** e **NON**, anche su più livelli. Una regola senza condizioni vale sempre. Le regole possono essere disattivate.

Azioni:

| Azione | Effetto |
| --- | --- |
| Aggiungi componente | Include il componente con quantità fissa o calcolata. |
| Escludi componente | Vieta il componente. Se una regola lo aggiunge, la configurazione è in conflitto. |
| Richiedi componente | Verifica che una regola di inclusione lo aggiunga; non lo aggiunge da sola. |
| Uno solo tra i componenti | Richiede esattamente uno dei componenti selezionati, aggiunto dalle regole. |
| Richiedi valore | Impone un valore del parametro quando le condizioni sono vere. |
| Escludi valore | Impedisce un valore del parametro quando le condizioni sono vere. |

Le quantità di più inclusioni dello stesso componente **si sommano**. Le regole duplicate vengono segnalate perché potrebbero raddoppiare le quantità.

La quantità calcolata ha forma `quantità × parametro numerico ÷ divisore`, con arrotondamento nessuno/per eccesso/per difetto. Esempio: quantità 1 × Larghezza ÷ 1000, per eccesso, genera 5 staffe per 4500 mm. Non vengono eseguite formule arbitrarie.

Le condizioni leggono solo parametri. Le azioni non attivano altre regole tramite i componenti: non ci sono catene ricorsive di inclusione. I vincoli di valore propagano le scelte obbligate senza sovrascrivere i valori scelti dall'utente.

## Esplora, distinta e varianti

- Puoi lasciare i parametri aperti; un valore assente non è trattato come "No" o come zero.
- Le scelte incompatibili con i vincoli attivi sono disabilitate.
- **Strade ancora aperte** consente di espandere un parametro e scegliere un ramo, restringendo progressivamente il progetto.
- La distinta distingue componenti certi, possibili e quantità da definire. **Perché questo componente?** mostra le regole che lo includono.
- Con un dominio finito completamente esaminato, i componenti certi sono presenti in ogni variante valida. Con numeri liberi o ricerca limitata, la distinta è conservativa rispetto alle condizioni e ai vincoli già determinati.
- **Genera configurazioni** mostra le soluzioni valide in pagine da 50 e consente di selezionare una variante. Non memorizza manualmente un albero di tutte le combinazioni.
- La ricerca avviene in un worker locale ed esamina al massimo **5.000 combinazioni**. Con cataloghi grandi il limite si riduce per contenere la memoria occupata dalle distinte. Se il dominio è più grande, l'elenco è indicato come parziale e il conteggio non viene presentato come totale. Restringi le scelte per completare la ricerca.
- **CSV** esporta la distinta con codice, descrizione, gruppo, quantità, unità, stato e regole. **CSV varianti** esporta le scelte delle configurazioni trovate; con ricerca limitata contiene solo il campione indicato a schermo. I CSV usano separatore `;` e BOM UTF-8 per Excel.
- **Esporta** salva una copia del progetto come `.config.json`. Per riutilizzarla, copiala nella cartella del Vault e aggiorna la struttura. La prima versione non include importazione massiva di cataloghi Excel/CSV, solver esterno, sottoassiemi ricorsivi o formule libere.

## Note e grafo

**Collegamento** copia `[[Configurators/<nome>.config.json]]`, da incollare in una nota. È possibile usare anche `[[Nome configuratore]]` quando risolve in modo univoco; il percorso completo evita ambiguità. I link Markdown relativi ai file `.config.json` funzionano in lettura e nell'editor.

L'anteprima al passaggio sul link mostra il riepilogo del configuratore. Sotto al grafo trovi schede tecniche e note che lo collegano, in sezioni richiudibili. Il pannello destro elenca invece i componenti della configurazione corrente. Selezionando una scheda tecnica si apre la nota nel normale editor.

Il **Grafo** del configuratore è distinto dal grafo delle note: mostra percorsi dai parametri, in ordine di inserimento, fino ai componenti. Le condizioni aperte hanno linee tratteggiate, le esclusioni linee rosse. Seleziona un componente per vedere le regole collegate. La vista sviluppa fino a 64 alternative per regola e 256 percorsi, segnalando eventuali tagli; non è la sorgente dei dati.

## Analisi e protezione dei dati

Analisi controlla definizioni incomplete, riferimenti mancanti, codici duplicati, parametri senza effetto, componenti mai aggiunti, regole duplicate e alcune condizioni contraddittorie. La verifica globale dei percorsi è esaustiva solo su domini finiti entro il limite; con numeri liberi o troppe combinazioni lo segnala chiaramente. I conflitti della configurazione corrente sono mostrati anche in Esplora.

La chiusura di un configuratore, la chiusura di tutte le schede, il cambio/disconnessione del Vault e le operazioni di rinomina/spostamento attendono il salvataggio. In caso di errore, le bozze restano disponibili e le operazioni bloccate. La chiusura della finestra segnala bozze non salvate.

Il salvataggio controlla dimensione e data di modifica del file. Se un'altra applicazione lo ha modificato, Nebula conserva la bozza ed evita di sovrascriverlo. **Esporta** permette di salvare una copia; **Ricarica dal Vault** scarta la bozza solo dopo conferma. Al ritorno alla finestra vengono riletti i file modificati esternamente se non ci sono bozze. Il controllo non è un lock multiprocesso: evita la modifica simultanea dello stesso file in due applicazioni.

L’icona **Aggiungi regola** si evidenzia in viola quando il componente è coinvolto in almeno una regola attiva con condizioni. Il suggerimento al passaggio del mouse indica quante regole lo condizionano. Le regole disattivate e quelle senza condizioni non attivano l’evidenziazione.

Le viste del configuratore e la raccolta dei progetti utilizzano una sola barra di scorrimento verticale nell’area di lavoro. I dettagli nei popup mantengono lo scorrimento interno quando necessario.


## Gruppi annidati E, O e NON (0.17.0)

Nel popup della regola, **Condizione** aggiunge un confronto al gruppo corrente e **Gruppo** crea un livello interno. Il selettore di ciascun gruppo permette E (tutte vere), O (almeno una vera) e NON (nega il risultato). Cambiare un gruppo con più elementi in NON racchiude il gruppo intero, conservando il suo operatore e le condizioni. Il comando NON accanto a un confronto nega solo quella condizione; **Rimuovi NON** recupera l’elemento racchiuso.

Esempio: `E(Modello = "A"; O(LED = Sì; Motore = Sì); E(Larghezza ≥ 3000; Profondità ≤ 5000); NON(Montaggio = "Parete"))`.

Bordi colorati, sigle e collegamenti mostrano i confini della concatenazione: viola per E, verde acqua per O, ambra per NON. La freccia comprime un gruppo lasciandone visibile il riepilogo. L’espressione completa sotto l’albero mostra sempre tutte le parentesi. Maniglia e frecce riordinano gli elementi all’interno dello stesso gruppo. Applica salva; Annulla scarta anche le modifiche ai gruppi.

Un gruppo E alla radice senza condizioni significa Sempre. Gli altri gruppi vuoti sono incompleti e devono essere compilati o eliminati prima di applicare. NON ha un solo elemento, che può essere una condizione o un gruppo: un parametro non scelto non diventa vero per effetto della negazione.

Le regole annidate sono valutate in Esplora, BOM, varianti e Analisi; il grafo include anche i parametri nei gruppi interni. I file versione 1 restano leggibili con lo stesso comportamento. Quando si modifica un albero, il configuratore viene salvato in versione 2; le vecchie versioni di Nebula devono essere aggiornate per aprirlo. Fino a 32 livelli e 1000 nodi per regola sono ammessi in lettura.


## Elenco componenti per Gruppo / assieme (0.17.1)

I componenti sono suddivisi in sezioni con il nome del Gruppo / assieme e il conteggio. Il nome del gruppo compare una sola volta nell’intestazione. Codice, descrizione e metadati sono sulla stessa riga; tutti i campi sono disponibili nel popup. I componenti non assegnati sono nella sezione **Senza gruppo**.

Il drag&drop, le frecce e il riordino touch agiscono all’interno del gruppo corrente. L’ordine iniziale dei gruppi segue la prima comparsa nel catalogo; puoi poi riordinarli con la maniglia o le frecce. Per cambiare gruppo, modifica **Gruppo / assieme** nei dettagli del componente e applica. Il riordino conserva identificativi, regole e assegnazioni, e viene salvato nel Vault.


## Navigazione e grafo (0.18.0)

Le regole si aggiungono, modificano, eliminano e riordinano dalla scheda del componente; la tab Regole non è più presente. **Vincoli generali senza componente**, nella sezione Componenti, mantiene accessibili i vincoli sui valori dei parametri e le definizioni non ancora collegate.

Il grafo ha una colonna per parametro, nell’ordine impostato, e termina sui componenti. Ogni percorso è un’alternativa; i confronti nella stessa casella sono tutti necessari. O crea percorsi separati, E li concatena, NON nega i confronti applicando anche la negazione dei gruppi. «Qualsiasi valore» indica un parametro che quel percorso non vincola. Seleziona una linea per l’espressione completa, o il componente per tutte le sue regole. Le esclusioni sono rosse; le linee tratteggiate hanno scelte aperte; i percorsi incompatibili sono attenuati. Le regole disattivate non generano percorsi, ma restano visibili nella scheda del componente.

Il grafo segnala i limiti di 64 alternative per regola e 256 percorsi complessivi. I vincoli generali non producono un componente diretto e si gestiscono dalla sezione dedicata; i loro effetti restano applicati nel calcolo di Esplora/BOM/Analisi.


## Riordino e selezione dei percorsi (0.18.1)

Nella scheda **Parametri**, trascina la maniglia o usa le frecce; sulla maniglia funzionano anche **Alt + freccia su/giù** e il trascinamento touch. Il nuovo ordine si salva nel configuratore e viene usato sia da Esplora sia dalle colonne del grafo. Gli identificativi restano uguali, perciò le regole conservano i loro riferimenti.

Le voci uguali nella stessa colonna sono un nodo unico, indipendentemente dal percorso precedente. Anche «Qualsiasi valore» è mostrato una sola volta per parametro. Le linee condivise sono affiancate e colorate per percorso; ogni alternativa e destinazione conserva la propria identità.

Cliccando una voce, il grafo evidenzia tutti i suoi percorsi completi, da prima della voce fino ai componenti, e ingrigisce quelli non interessati. La selezione usa i percorsi delle regole, senza combinare liberamente rami che condividono un nodo. Un secondo clic, **Esc** oppure **Mostra tutti i percorsi** annulla la selezione. La funzione è utilizzabile anche con Tab e Invio/Spazio.

I confronti di uguaglianza mostrano solo il valore, senza =. Per la disuguaglianza, ≠ e il valore sono rossi. Gli altri operatori numerici restano visibili per conservare il significato del confronto. La selezione nel grafo cambia soltanto l’evidenziazione, non le scelte di Esplora o le regole salvate.


## Una sola regola per componente (0.19.0)

La riga del componente e la sua scheda aprono sempre la stessa regola. Estendi la concatenazione con Condizione e Gruppo (E/O/NON) e applica: il salvataggio aggiorna la regola esistente. L’associazione resta esplicita anche se le azioni vengono cambiate in vincoli sui parametri.

Per i file precedenti con più regole collegate, la scheda presenta una sola regola unificata. **Applica** sostituisce le precedenti, **Annulla** conserva il file originale. Condizioni incompatibili tra loro con azioni identiche possono essere unite in O; quantità diverse, effetti differenti o inclusioni che si sommano restano alternative visibili, ciascuna con le proprie condizioni e azioni. Puoi modificare le alternative o eliminarle esplicitamente. Nessuna regola precedente resta attiva separatamente dopo l’unificazione.

Le alternative possono attivarsi insieme: in quel caso le inclusioni si sommano, come nei configuratori precedenti. Eventuali condizioni e azioni comuni si applicano a tutta la regola. Se la regola è condivisa, la stessa regola unificata compare nelle schede degli altri componenti collegati; l’editor lo segnala. I file con queste associazioni usano il formato versione 3 e richiedono Nebula 0.19.0 o successiva. Esplora, BOM, Analisi e grafo valutano anche tutte le alternative.


## Famiglie e sezioni comprimibili (0.20.0)

La scheda del componente include **Famiglia**, per esempio PROFILI o ACCESSORI. Una famiglia contiene i gruppi/assiemi dei componenti che le assegni. Puoi digitare un nome nuovo oppure scegliere una famiglia esistente. Il comando con la cartella accanto al gruppo apre **Famiglia del gruppo** e assegna in un solo passaggio tutti i suoi componenti. Il campo vuoto corrisponde a **Senza famiglia**. Due gruppi con lo stesso nome in famiglie diverse sono distinti.

Trascina le maniglie nelle intestazioni per riordinare le famiglie o i gruppi all’interno della famiglia. Sono disponibili anche frecce, Alt + frecce e touch. Il riordino dei singoli componenti resta limitato al rispettivo gruppo e famiglia. Clicca il titolo di una famiglia o di un gruppo per comprimerlo o espanderlo. Il conteggio resta visibile. Queste preferenze si salvano nel file insieme alla configurazione; i file precedenti vengono aperti in Senza famiglia.

## Riepilogo sul tasto delle regole (0.20.0)

Passando il mouse sul tasto **Modifica regola** o **Aggiungi regola**, vedi una lista numerata e compatta delle condizioni e delle azioni abilitate del componente, nell’ordine salvato. Le quantità e gli eventuali calcoli sono inclusi. Il clic destro tiene aperto il riepilogo, chiudibile con **Chiudi riepilogo**, Esc o un clic esterno. Le regole e le alternative disattivate non compaiono. Attiva significa abilitata: la valutazione sulle scelte correnti è mostrata in Esplora e nel grafo. Il clic sinistro continua ad aprire la regola unica completa.

## Ridurre le diramazioni del grafo (0.20.0)

Tieni **Ctrl** (⌘ su Mac) e clicca più parametri attivi o con scelte aperte: rimangono i percorsi completi compatibili con tutte le voci selezionate, includendo anche i passaggi senza vincoli su quei parametri. Le altre diramazioni spariscono e il grafo si compatta. I nodi condivisi e i colori dei percorsi rimangono coerenti. La selezione non crea nuove regole e non cambia le scelte di Esplora. Se una voce era già evidenziata con un clic normale, viene inclusa quando aggiungi un parametro con Ctrl.

Un altro Ctrl + clic su una voce selezionata, o la × nel riepilogo sopra il grafo, la rimuove dal percorso. **Mostra tutti i percorsi** o Esc cancella il filtro. Da tastiera, usa Ctrl/⌘ + Invio o Spazio sui nodi. Un clic normale conserva la funzione di evidenziare le strade precedenti e successive e ingrigire quelle estranee.

Le intestazioni terminali Famiglia e Gruppo e i componenti seguono lo stesso ordine del catalogo. Comprimere una sezione in Componenti non nasconde i suoi percorsi nel grafo.


## Scelte compatibili e passaggi senza vincoli (0.20.1)

**Qualsiasi valore** significa che quella specifica alternativa della regola non dipende dal parametro. Quando selezioni un valore concreto, il grafo include automaticamente anche questi percorsi. Per esempio, selezionando **LED = Sì** vedrai sia gli accessori condizionati da LED = Sì sia i profili che dipendono soltanto dal modello. Con Ctrl/⌘, scegliendo anche **Modello = A**, i percorsi che richiedono esplicitamente Modello = B restano esclusi. Un’alternativa senza vincoli sul modello resta compatibile. Le condizioni annidate E/O/NON conservano le proprie alternative: i nodi condivisi non generano combinazioni nuove tra percorsi diversi.

Il clic normale evidenzia i percorsi compatibili e ingrigisce quelli estranei. Ctrl/⌘ + clic nasconde le diramazioni incompatibili con tutte le scelte. Solo i valori selezionati direttamente hanno il bordo di selezione. La funzione cambia la vista del grafo, senza modificare regole, distinta o scelte di Esplora.

La vista compatta è quella iniziale: salta tutti i nodi **Qualsiasi valore**, unendo direttamente le condizioni presenti e il componente. Quando un percorso non ha alcuna condizione, parte da **Sempre**. In alto, il comando **Mostra passaggi senza vincoli** ripristina i nodi neutri, mantenendo filtro, colori e percorsi. Nella vista estesa puoi anche selezionare esplicitamente “Qualsiasi valore” per isolare le alternative che non dipendono da quel parametro. **Mostra tutti i percorsi**, Esc e i comandi × continuano a rimuovere i filtri.


## Pannello componenti e informazioni sotto al grafo (0.21.0)

Il pannello destro elenca i componenti inclusi nelle scelte correnti, separati per famiglia e gruppo nello stesso ordine del catalogo. Ogni voce mostra codice, descrizione, quantità e unità; **Certo** indica un componente presente nelle configurazioni compatibili esaminate completamente, oppure già determinato dalle condizioni correnti. **Possibile** indica un componente che dipende da scelte ancora aperte. Le quantità variabili o dipendenti da numeri non definiti sono indicate con **Da definire**. Quando la ricerca non può essere completata, il pannello segnala il limite; non usa un campione per dichiarare certi i componenti.

Le scelte fatte in Esplora restano il punto di partenza. Nel grafo, un clic su un parametro aggiorna il calcolo per quel parametro; Ctrl/⌘ combina le scelte. Selezionare una linea applica al calcolo le condizioni di quel percorso. I confronti ≠ e le soglie numeriche sono rispettati senza inventare valori per le quantità. **Mostra tutti i percorsi** ripristina le scelte di partenza di Esplora. Il clic sul componente mantiene la configurazione mentre ne evidenzia i percorsi. Le scelte del grafo non modificano quelle di Esplora né i file del Vault.

Sotto al grafo trovi tre sezioni inizialmente chiuse: **Dati del progetto**, **Schede tecniche** e **Note collegate**. Aprile dal titolo per leggere le informazioni o aprire una nota. I dettagli della voce o del percorso evidenziato sono anch’essi richiudibili. L’area di lavoro mantiene uno scorrimento verticale unico.

## Aprire e modificare le regole dal grafo (0.21.0)

Fai **doppio clic sulla casella del componente**: si apre direttamente la sua regola completa. Da tastiera, porta il focus sulla casella e premi **F2**. Puoi anche espandere il riepilogo sotto al grafo e scegliere **Modifica regola del componente**. Il clic singolo e Invio/Spazio continuano a evidenziare i percorsi.

Il popup usa lo stesso editor della scheda Componenti: conserva E/O/NON, alternative, azioni, quantità, stato attivo e collegamenti condivisi. **Applica** aggiorna la regola esistente e ricalcola la lista; **Annulla**, la croce o Esc scartano la bozza e tornano al grafo. Durante la compilazione il calcolo è sospeso per mantenere stabili campi e focus. Se la regola è condivisa con altri componenti, il popup lo segnala e l’aggiornamento resta unico per tutti i componenti collegati.


## Scegliere le opzioni direttamente dalla BOM (0.21.2)

Apri **BOM**: a sinistra trovi **Opzioni della BOM**, con i valori disponibili raggruppati per parametro. I pulsanti hanno larghezza basata sul testo e si dispongono su più righe quando serve; a destra trovi la distinta dei componenti. Il pannello contestuale destro si chiude automaticamente a ogni apertura della BOM. Su schermi piccoli, le opzioni precedono la distinta in un’unica colonna. Puoi selezionare più parametri insieme; per ciascun parametro scegli un solo valore. Clicca di nuovo il valore attivo per deselezionarlo e tornare a tutte le possibilità. Per esempio, **Modello A** e **LED Sì** mostrano i componenti di quella combinazione; deselezionando **LED Sì** torni alle varianti con e senza LED, mantenendo Modello A.

Il segno di spunta e il bordo evidenziato identificano i pulsanti selezionati. Le opzioni incompatibili con le altre scelte vengono disabilitate; il suggerimento indica il motivo. Puoi sempre deselezionare una scelta già attiva per correggere una configurazione non valida. I risultati si ricalcolano localmente e i pulsanti restano utilizzabili durante l’aggiornamento. Puoi navigarli anche con Tab e attivarli con Invio o Spazio.

I parametri numerici con intervallo e passo mostrano i valori come pulsanti. Il campo numerico resta disponibile: il suo valore e il pulsante attivo sono sincronizzati, incluso lo zero. Il pulsante **Cancella [parametro]** rimuove il valore numerico. Senza un insieme finito di valori, usa direttamente il campo numerico. Per parametri con molte opzioni, usa **Mostra altre opzioni di [parametro]** e **Comprimi opzioni di [parametro]**; il valore selezionato rimane visibile anche nell’elenco compatto.

BOM ed Esplora condividono le scelte, quindi puoi passare da una scheda all’altra senza ricompilarle. La distinta, le quantità, il pannello destro e l’esportazione CSV usano le scelte correnti. **Azzera scelte** ripristina tutti i parametri. Queste selezioni non modificano le definizioni o le regole salvate nel Vault.


## Vincoli direttamente dai parametri (0.22.0)

1. Apri **Parametri** e clicca l’icona delle regole accanto al parametro. Nei suoi dettagli trovi anche il riepilogo e **Gestisci vincoli**.
2. L’elenco mostra i vincoli associati, inclusi quelli precedenti e quelli che coinvolgono il parametro come condizione o valore richiesto/escluso. Le regole che aggiungono componenti si gestiscono dai componenti.
3. Premi **Vincolo**. In **QUANDO** scegli parametro, confronto e valore, combinando condizioni e gruppi **E/O/NON**. In **ALLORA** scegli **Escludi valore** o **Richiedi valore**, il parametro destinatario e il suo valore. Puoi aggiungere più azioni.
4. **Applica** salva e chiude. La stessa regola riaperta mostra i dati salvati. Puoi disattivarla con **Attiva**; le icone evidenziano solo i vincoli attivi.

Esempi: **LED = Sì → Escludi Telo: Sì** impedisce di selezionare entrambi; **Modello = A → Richiedi Motore: Sì** rende obbligatoria quell’opzione. La presenza si descrive con il valore che la rappresenta, per esempio Sì: il parametro rimane definito nella configurazione. Se un vincolo è condiviso, modificarlo o eliminarlo aggiorna tutte le viste che lo mostrano.

Le eliminazioni nell’elenco restano provvisorie fino ad **Applica**. **Annulla** scarta eliminazioni e modifiche della finestra; entrando dai dettagli conserva la bozza del parametro. **Torna all’elenco dei vincoli** scarta la sola bozza della regola aperta. I vincoli senza azioni o con valori non validi non possono essere applicati.

Le incompatibilità disabilitano le opzioni non disponibili nella BOM e in Esplora; i risultati del grafo e le varianti rispettano gli stessi vincoli. Una scelta già attiva resta deselezionabile. L’associazione viene conservata nel file `.config.json` formato 3; i file precedenti rimangono leggibili e i dati restano nel Vault locale.


## Rendere selezionabile un singolo valore solo a certe condizioni (0.23.0)

1. Apri **Parametri**, poi l’icona delle regole accanto a **TELO**. Puoi accedervi anche dai dettagli con **Gestisci vincoli**.
2. In **Selezionabilità dei valori**, clicca **Sì**. I valori senza condizione sono indicati come **Sempre selezionabile**, nel rispetto degli eventuali altri vincoli generali.
3. Nel blocco **SELEZIONABILE SOLO SE** imposta **MODELLO = TELO**. Puoi combinare più condizioni con **E/O/NON**, usare i confronti numerici, comprimere i gruppi e riordinarli.
4. Premi **Applica**. La condizione è memorizzata nel parametro, sul solo valore Sì. Riaprendo la finestra compare l’espressione salvata. **Annulla** scarta la bozza.

Con MODELLO non scelto, Sì è selezionabile: puoi sceglierlo prima di definire il modello. Con MODELLO = TELO rimane selezionabile; con un altro MODELLO si disabilita. Cancellando MODELLO torna disponibile. Anche nelle condizioni E/O/NON, una condizione ancora indeterminata lascia aperta la scelta; una condizione falsa la blocca. Le combinazioni complete devono comunque rispettare il vincolo. No non riceve automaticamente lo stesso vincolo. I pulsanti BOM e gli elenchi di Esplora mostrano la stessa disponibilità. Il suggerimento delle opzioni disabilitate indica la condizione da completare. Un valore già attivo rimane deselezionabile anche se una modifica alle definizioni lo rende incompatibile.

Puoi disattivare la condizione con **Condizione attiva** o eliminarla con il cestino accanto al valore, rendendolo nuovamente libero dal requisito specifico. Per i numeri puoi indicare **Valore numerico da vincolare**, incluso lo zero. Le liste lunghe si espandono con **Mostra altri valori**; i valori con una condizione rimangono visibili. Una condizione non può riferirsi al parametro stesso; riferimenti mancanti e valori rimossi sono segnalati.

Le combinazioni generate e i calcoli del grafo verificano le condizioni dei valori insieme alle regole già esistenti. Le condizioni di selezionabilità si salvano nel file `.config.json` in formato 4: per aprirlo occorre Nebula 0.23.0 o successiva. I file nei formati precedenti si aprono ancora; modificarli senza aggiungere condizioni ai valori conserva il formato precedente. Le modifiche successive a componenti, famiglie e regole conservano il formato 4 quando presente.


## Distinta compatta (0.23.2)

Codice e descrizione condividono la riga; a destra trovi quantità e unità affiancate. Gli spazi verticali sono ridotti e le descrizioni lunghe vanno a capo senza essere troncate. Per le configurazioni parziali rimane visibile **Possibile**; per quantità variabili compare **Da definire**.

La piccola icona informazioni apre o chiude le motivazioni e mostra famiglia, gruppo/assieme ed eventuale collegamento alla scheda tecnica. La scritta «Perché questo componente?» non compare più nell’elenco. Il comando è raggiungibile da tastiera e mantiene un’area più ampia sui dispositivi touch. Le selezioni, i calcoli e l’esportazione CSV mantengono il comportamento precedente.


## Quantità e misura del componente indipendenti (0.24.0)

Apri **Componenti** e i dettagli del componente. Attiva **Misura calcolata per pezzo**, poi imposta:

- **Parametro di partenza**: un parametro numerico, per esempio Larghezza.
- **Unità misura**: l’unità del risultato; mm, cm e m si convertono automaticamente prima di applicare la correzione. Unità personalizzate restano disponibili se uguali a quella del parametro.
- **Correzione (+ / −)**: un valore espresso nell’unità del risultato, per esempio −1 cm.

La formula visualizzata rimane associata al componente. Con Larghezza 300 cm e correzione −1 cm il risultato è **299 cm**; con Larghezza 3000 mm, risultato in cm e correzione −1, il risultato è ancora **299 cm**. Una correzione positiva aggiunge materiale. **Applica** salva; **Annulla** conserva il valore precedente. La misura si può disattivare in qualsiasi momento.

La quantità si imposta nella regola, con il comportamento già disponibile: conteggio fisso oppure formula con parametro, divisore e arrotondamento. Per esempio **2 pz** di profilo possono avere ciascuno misura **299 cm**. La misura non viene moltiplicata per la quantità e non si somma se più regole aggiungono lo stesso componente. Gli accessori possono avere solamente le quantità, senza attivare la misura.

La distinta compatta distingue **Mis.** e **Q.tà**; l’icona informazioni mostra la formula della misura. Il pannello componenti del grafo mostra lo stesso risultato. Il CSV aggiunge **Misura per pezzo** e **Unità misura** dopo le colonne esistenti; queste celle sono vuote per gli accessori senza misura.

Se il parametro non è definito, oppure le varianti valide producono misure diverse, compare **Da definire** senza inventare una misura unica. Una selezione precisa aggiorna la misura. Una misura negativa o non finita rende non valida la combinazione che include il componente; riferimenti mancanti, parametri non numerici e unità incompatibili vengono segnalati.

Le formule si salvano dentro al componente nel formato `.config.json` versione 5, che richiede Nebula 0.24.0 o successiva. I file precedenti rimangono leggibili; le modifiche a parametri, regole e organizzazione conservano il formato 5 quando presente.


## Dimensioni multiple (0.27.0)

Nella scheda del componente usa **Dimensione** per aggiungere una riga. Scegli Lunghezza (L), Larghezza (L), Altezza (H), Profondità (P), Spessore (S) o Personalizzata. Ogni riga ha un parametro numerico, una correzione indipendente e un’unità; l’icona cestino rimuove soltanto quella dimensione. Le conversioni mm/cm/m precedono la correzione. I nomi delle dimensioni devono essere unici nel componente. Non sono richieste dimensioni per gli accessori.

La distinta mantiene una sola cella centrata: ad esempio **L 298 × H 397 cm**, con quantità **1 pz** separata. Una sola dimensione resta **299 cm**; unità diverse sono mostrate accanto a ciascun valore. Se Lunghezza e Larghezza sono presenti insieme, si usano i nomi estesi per distinguerle. Una dimensione non ancora determinata non cancella le altre misure note.

Il CSV conserva le colonne esistenti. Quando il catalogo contiene componenti con più dimensioni, aggiunge per ogni nome una colonna numerica e la relativa unità. La colonna Misura per pezzo contiene anche il riepilogo leggibile.

I file versione 1–5 rimangono leggibili senza riscrittura automatica. Modificare le righe Dimensioni salva il componente con la nuova lista `dimensions` e porta il configuratore al formato 6. Altri dati, regole e quantità rimangono invariati. Il formato 6 richiede Nebula 0.27.0 o successiva.

Nel Vault di prova aggiornato, AC019 è un telo: con Larghezza 300 cm e Sporgenza 300 cm produce **L 298 × H 297 cm**. Le copie di prova già modificate nel browser non vengono sovrascritte; il download ZIP include il campione aggiornato.


## Testo e proprietà dei componenti (0.28.0)

In **Parametri → Parametro**, scegli **Tipo → Testo** per un campo libero, ad esempio Materiale, Finitura o Riferimento cliente. In Esplora e nelle Opzioni della BOM puoi scrivere il valore; il pulsante di cancellazione lo svuota. Le scelte restano ricordate per progetto come gli altri parametri.

In **Componenti → Dettagli → Proprietà**, usa **+ Proprietà**. Ogni riga contiene il nome visibile e il parametro di testo collegato; il cestino rimuove soltanto quel collegamento. Il nome viene proposto dal parametro e può essere modificato. Puoi collegare lo stesso parametro a più componenti. I nomi devono essere non vuoti e unici dentro al componente. Se non esistono parametri di testo, crea prima il parametro dalla relativa sezione.

Esempio: parametro Materiale telo = PVC 650; proprietà Materiale collegata a Materiale telo. Il telo mostra **Materiale: PVC 650** sotto la descrizione nella BOM, oltre alle dimensioni e alla quantità separate. Le proprietà compaiono anche nel riepilogo e nel pannello componenti del grafo. Il CSV aggiunge una colonna **Proprietà: Materiale**. Virgolette, punti e virgola e testo Unicode sono conservati.

Il testo usato soltanto come proprietà è facoltativo: lasciarlo vuoto mostra **Da definire** senza bloccare varianti, quantità o misure. Se un parametro Testo è usato nelle regole, supporta **uguale / diverso** con confronto esatto, sensibile a maiuscole e spazi. Prima di enumerare un dominio testuale libero usato nelle regole, inserisci il valore; il motore non inventa un elenco di stringhe. Le condizioni sulle opzioni possono vincolare specifici testi. Un valore richiesto da una regola attiva viene propagato alla proprietà.

I parametri di testo non si possono usare come sorgenti di misure o quantità. Eliminare un parametro segnala i componenti che lo usano come proprietà; un riferimento mancante o passato a un tipo diverso è segnalato in Analisi e nella scheda.

Le definizioni si salvano nel formato 7, che richiede Nebula 0.28.0 o successiva. I file 1–6 rimangono leggibili. Il valore inserito resta tra le preferenze locali della configurazione; la definizione del parametro e dei collegamenti si salva nel file del Vault. Il campione ZIP aggiornato include Materiale telo collegato ad AC019; i file di prova già presenti nel browser non vengono sovrascritti.


## Opzioni di testo e valori autonomi (0.29.0)

Nei dettagli di un parametro **Testo**, inserisci **Opzioni (una per riga)** e usa la spunta **Consenti testo personalizzato**. Con la spunta attiva, la BOM offre i pulsanti delle opzioni e un campo libero; Esplora offre il campo con suggerimenti. Con la spunta disattivata si possono scegliere soltanto i valori elencati: pulsanti nella BOM, elenco in Esplora. La lista chiusa deve avere almeno un valore, senza righe vuote o duplicati. I testi già presenti nei file precedenti restano liberi per compatibilità.

Nella scheda del componente, ogni proprietà ha **Origine**:

- **Dalla BOM**: segue il parametro selezionato nella configurazione.
- **Valore del componente**: usa un valore specifico, proposto dalle opzioni o scritto liberamente nella scheda. Resta indipendente dal testo selezionato nella BOM e non aggiunge opzioni al parametro generale. La spunta del parametro riguarda l’inserimento nella configurazione e non limita questo valore locale.

Esempio: Materiale telo offre PVC e Acrilico. Il telo può seguire la BOM; un bordo di protezione può usare il valore del componente Poliestere. Cambiare Materiale telo lascia il bordo invariato. Tornare a Dalla BOM rimuove il valore locale e riattiva il collegamento. Il valore locale non può essere vuoto; Applica salva e Annulla conserva la definizione precedente.

BOM, riepilogo, grafo e CSV mostrano il valore effettivo di ciascun componente. Il testo usato soltanto come proprietà resta facoltativo; gli elenchi chiusi usati nelle regole sono domini finiti enumerabili. I file che usano le nuove impostazioni si salvano in formato 8 e richiedono Nebula 0.29.0 o successiva.

Il campione scaricabile offre Materiale telo con PVC/Acrilico e testo libero: AC019 segue la BOM, AC020 usa Poliestere. Le copie già presenti nel browser non vengono sovrascritte.


## Duplicare un componente (0.30.0)

In **Componenti**, apri il menu **⋯ → Duplica** della riga. La copia viene creata subito dopo l’originale, nella stessa famiglia e nello stesso gruppo, e si apre la sua scheda per rinominare codice e descrizione. Il codice proposto è `CODICE-COPIA`, oppure `CODICE-COPIA-2` e successivi se già presente.

Sono copiati unità, collegamento alla scheda tecnica, dimensioni con correzioni, proprietà e valori autonomi, condizioni, quantità, alternative e regole disattivate. I nuovi identificativi distinguono la copia dall’originale. La scheda tecnica resta un collegamento alla stessa nota del Vault.

Nelle regole condivise vengono copiate le azioni del componente scelto; le aggiunte e le esclusioni relative agli altri componenti non vengono ripetute. I riferimenti ai parametri e ai componenti richiesti o alternativi continuano a puntare agli elementi esistenti del catalogo.

La duplicazione crea già il componente e le sue regole. **Applica** salva le successive modifiche nella scheda; **Annulla** scarta soltanto queste modifiche, lasciando la copia creata. Il normale salvataggio automatico conserva la duplicazione, oppure usa **Salva** per scriverla subito nel file. La funzione usa i formati del configuratore esistenti.

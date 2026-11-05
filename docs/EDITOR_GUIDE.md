# Editor Nebula 0.14.0

## Scrivere e leggere

Scrivi e lettura condividono font di sistema, dimensioni dei titoli, larghezza del documento e stile dei link. Il font resta disponibile offline. Non viene evidenziata la riga del cursore e i colori della sintassi sono riservati a Sorgente.

Le note si aprono in Scrivi, che comprende anche l’anteprima: il testo resta formattato mentre lavori. I simboli Markdown compaiono soltanto sull’elemento che contiene o tocca il cursore. Se selezioni testo, i simboli restano nascosti anche dopo aver applicato un formato. Il Markdown originale resta nel file; la copia dagli appunti conserva il Markdown.

Rimangono due modalità: Scrivi e Sorgente. Sorgente mostra tutta la sintassi, con numeri di riga, per le modifiche precise. In Impostazioni → Editor puoi scegliere la modalità di apertura; le vecchie preferenze Anteprima diventano Scrivi. La scelta per singola nota viene conservata durante la sessione.

Cronologia, cursore e scorrimento rimangono disponibili cambiando modalità, scheda o sezione. I file vengono salvati automaticamente dopo 900 ms di pausa. La cronologia Annulla/Ripristina è in memoria fino alla chiusura dell’app o al cambio Vault: non sostituisce un backup.

## Bloccare la pagina per leggere

Usa il lucchetto **Blocca** vicino a Scrivi/Sorgente. La pagina mostra l’anteprima completa con testo selezionabile, senza barre di formattazione. Le caselle, le tabelle, l’incolla e le scorciatoie di modifica non possono cambiare il contenuto. Ctrl/⌘ A seleziona il contenuto della nota; Ctrl/⌘ C lo copia dalla pagina resa, senza i delimitatori Markdown nascosti. I collegamenti restano navigabili.

**Sblocca pagina** ripristina l’editor e la modalità usata prima del blocco. Selezione e cronologia Annulla/Ripristina dell’editor vengono mantenute. Lo stato del lucchetto è ricordato per nota durante la sessione, anche cambiando scheda o rinominando la nota; viene azzerato chiudendo l’app o cambiando Vault. Il blocco è una protezione dalle modifiche nell’interfaccia, non un permesso sul file locale. Le modifiche già inserite prima del blocco continuano a essere salvate automaticamente.

## Dimensioni e larghezza

Il pulsante **Aspetto della pagina** (icona del testo) accanto al lucchetto contiene due cursori: **Dimensione del testo** da 14 a 24 px e **Larghezza della pagina** da 560 a 1200 px. **Usa tutta la larghezza** adatta il documento allo spazio disponibile. Su schermi più piccoli la pagina rispetta sempre i margini dello schermo.

I controlli funzionano anche in Scrivi senza lucchetto e in Sorgente. Sono preferenze di visualizzazione locali, ricordate tra le aperture dell’app: non cambiano il Markdown o la formattazione salvata nella nota. Puoi usarli anche con il lucchetto chiuso. **Ripristina** torna a 17 px e 780 px.

## Formattazione

Usa la barra superiore, seleziona il testo per la barra contestuale, oppure scrivi `/` a inizio riga. Il menu Inserisci contiene tutte le azioni, divise in Testo, Formato, Elenchi, Collegamenti e media, Blocchi. Il pulsante Guida cerca le stesse funzioni e mostra la sintassi.

Il corsivo lascia gli spazi iniziali e finali fuori dai delimitatori, riconosce anche `_testo_` e conserva il grassetto quando attivi o rimuovi il corsivo su `***testo***`.

Con almeno due note aperte, la scheda **Inizio** mostra una X rossa. **Chiudi tutte** nel messaggio di conferma salva le modifiche e chiude le schede. **Annulla** o Esc mantengono le note aperte. Se il salvataggio non riesce, le note restano aperte con un messaggio di errore.

| Funzione | Sintassi / scorciatoia |
|---|---|
| Titoli 1–6 | `# Titolo` fino a `###### Titolo`; Ctrl/⌘ Alt 1–6 |
| Grassetto | `**testo**`; Ctrl/⌘ B |
| Corsivo | `*testo*`; Ctrl/⌘ I |
| Barrato | `~~testo~~`; Ctrl/⌘ Shift X |
| Evidenziatore | `==testo==`; Ctrl/⌘ Shift H |
| Codice in linea | delimitatori backtick; Ctrl/⌘ Shift C |
| Elenco puntato | `- Elemento` |
| Elenco numerato | `1. Elemento` |
| Checklist | `- [ ] Da fare`, `- [x] Fatto` |
| Citazione | `> Testo` |
| Separatore | `---` su una riga separata |
| Inserisci elemento | `/` a inizio riga; Ctrl/⌘ Shift P |
| Collegamento | Ctrl/⌘ K |
| Trova e sostituisci | Ctrl/⌘ F oppure Ctrl/⌘ H |
| Salva | Ctrl/⌘ S |
| Annulla / Ripristina | Ctrl/⌘ Z / Ctrl/⌘ Shift Z |
| Guida | F1 |

Premi Invio negli elenchi per continuare la lista, Invio su un elemento vuoto per uscirne. Tab rientra il testo. In Scrivi le caselle sono cliccabili; la sintassi appare solo se il cursore si trova sul relativo indicatore. Spunte e scrittura condividono la cronologia Annulla.

## Note e collegamenti

Scrivi `[[` e scegli una nota: vengono inseriti il percorso completo e `]]`, anche quando esistono nomi duplicati. Il menu Collegamento permette di cercare una nota, assegnare il testo visualizzato o crearne una nella cartella corrente. Il nuovo file resta locale e la nota di partenza rimane aperta.

I link web usano `[testo](https://esempio.it)`. Puoi incollare un URL su una selezione. In Scrivi un clic apre il collegamento. Per modificarne il testo o la destinazione, usa Alt+clic, raggiungilo con le frecce oppure passa a Sorgente. Trascinare per selezionare testo non apre il collegamento. In Sorgente rimane Ctrl/⌘ clic; Ctrl/⌘ Invio funziona con il cursore sul link in entrambe le modalità. I link esterni si aprono in una nuova scheda; i link a note aprono il documento nel Vault.

### Anteprima delle note collegate

Fermati brevemente con il mouse su un collegamento a una nota: dopo circa 350 ms compare un riquadro con titolo, percorso e un estratto formattato. Funziona sia in Scrivi sia nella lettura bloccata, anche sui link nelle tabelle. Mostra la bozza più recente se la nota è già aperta, altrimenti legge il file nel Vault senza aprire una scheda.

Il riquadro resta visibile entrando con il mouse al suo interno e si chiude allontanandoti, premendo Esc o scorrendo la pagina. Le note mancanti e i nomi ambigui hanno un messaggio esplicito. I collegamenti web esterni non vengono caricati in anteprima. Il riquadro non contiene media o controlli modificabili.

## Immagini

Inserisci → Immagine, oppure trascina/incolla un file immagine nell’editor. Nebula copia i file in `attachments/`, assegna un nome univoco e scrive un riferimento relativo nella nota. Immagini locali utilizzabili senza rete: PNG, JPG, GIF, WebP, AVIF e BMP fino a 20 MB ciascuna. Non sono supportati allegati SVG attivi. I riferimenti non possono uscire dal Vault.

Puoi anche indicare un percorso relativo, ad esempio `../attachments/foto.png`, oppure un URL http/https. Le immagini da URL richiedono la rete. Le immagini locali mancanti vengono segnalate nella nota. Le immagini con sintassi Markdown semplice sono mostrate direttamente in Scrivi; il riferimento compare quando il cursore raggiunge l’immagine.

## Tabelle

Il pulsante Tabella apre quella sotto il cursore; altrimenti ne crea una. In Scrivi la tabella è già visibile: usa Modifica tabella oppure un doppio clic su una cella. Per modificare i separatori Markdown usa Sorgente. La prima riga della griglia è l’intestazione. Puoi aggiungere o togliere righe/colonne, cambiare l’allineamento della colonna selezionata e incollare un intervallo Excel in una cella. Tab passa alla cella successiva; sull’ultima cella aggiunge una riga. Applica modifiche salva il risultato nel Markdown come una sola operazione annullabile.

Incollando una tabella HTML/TSV da Excel direttamente nella nota viene creata una tabella Markdown. I caratteri `|` nelle celle vengono protetti. Il dialogo gestisce tabelle Markdown standard al livello principale del documento; blocchi di codice che contengono esempi di tabelle restano testo.


### Unire celle e regolare la larghezza (0.14.0)

Apri **Modifica tabella**. Il selettore nell’angolo di una cella la seleziona; **Shift+clic** su un altro selettore sceglie il rettangolo tra le due celle. Da tastiera puoi estendere la selezione con Shift+frecce sui selettori. Attiva **Selezione multipla** per scegliere gli estremi con clic semplici, anche da touch. **Unisci celle** unisce il rettangolo; **Dividi celle** separa le celle unite. Le intestazioni si possono unire tra loro, ma non con le righe del corpo.

I testi originali rimangono nelle rispettive celle del Markdown e vengono mostrati insieme nella cella unita. Dividere ripristina i testi originali. Se modifichi il valore unito, il nuovo testo viene salvato nella prima cella: le altre restano vuote dopo la divisione, senza valori nascosti che ricompaiono. Aggiungere/rimuovere righe e colonne aggiorna anche le unioni; incollare un intervallo Excel divide le unioni che interseca.

Trascina un separatore sopra le colonne per ridimensionarle. Con il separatore a fuoco, ←/→ modifica la larghezza di 10 px. Il campo **Larghezza colonna in pixel** conferma il valore uscendo dal campo o con Invio (80–1200 px). **Larghezze automatiche** rimuove tutte le larghezze personalizzate. La larghezza delle celle segue la colonna; una cella unita segue la somma delle sue colonne. In Scrivi e lettura, una tabella più larga della pagina ha uno scorrimento proprio.

Le impostazioni si trovano nel commento `<!-- nebula-table:… -->` subito sotto la tabella, nello stesso file `.md`, visibile solo in Sorgente. **Applica modifiche** salva tutto con una sola operazione annullabile; chiudere senza applicare lascia la nota invariata. Altri lettori Markdown mostrano la griglia originale, senza le unioni/larghezze specifiche di Nebula.

## Blocchi

Per un riquadro informativo:

```md
> [!NOTE]
> Informazione utile.
```

Sono disponibili anche TIP, IMPORTANT, WARNING e CAUTION. In Scrivi hanno etichette leggibili e uno stile dedicato. Il menu Inserisci propone Nota, Suggerimento e Avviso.

Per un blocco di codice, usa Inserisci → Blocco di codice e sostituisci `text` con il nome del linguaggio desiderato. Il contenuto non viene eseguito.

## Ricerca e concentrazione

Trova e sostituisci cerca nella nota corrente, con opzioni maiuscole e parola intera. Invio/Shift Invio passano tra risultati. Sostituisci cambia l’occorrenza selezionata; se non c’è una selezione valida, porta prima al risultato. Sostituisci tutto applica tutte le modifiche insieme, annullabili con Ctrl/⌘ Z.

Il pannello Indice elenca i titoli reali della nota e permette di raggiungerli. Concentrazione porta l’editor a tutto schermo; premi Esc o il pulsante dedicato per tornare al layout precedente.

## Conflitti

Se il file cambia fuori da Nebula mentre stai scrivendo, il salvataggio automatico resta sospeso. Puoi continuare a lavorare sulla bozza e poi scegliere Ricarica da disco oppure Mantieni Nebula. Un errore di scrittura mantiene il testo nell’editor; usa Riprova dopo aver risolto l’errore.
# Modelli di note e procedure (0.11.0)

Collega un Vault e premi **Nuovo** nell’Explorer oppure nella pagina **Inizio**. Scegli **Nota libera**, **Procedura tecnica**, **Problema e soluzione** o **Appunto tecnico**, inserisci il titolo e scegli la cartella di destinazione. **Anteprima del modello** permette di controllare la struttura; **Crea nota** scrive il file Markdown completo e lo apre in Scrivi.

Per conservare una struttura personale, apri la nota e premi **Modello** nell’intestazione. Assegna un nome e conferma **Salva modello**. La copia viene salvata nella cartella **Modelli** del Vault; comprende il testo attuale dell’editor e non modifica l’originale. Puoi aprire quel file dall’Explorer per modificarlo. I file Markdown direttamente in Modelli compaiono nella scelta dei modelli personali.

Nel modello sono disponibili `{{titolo}}` e `{{data}}`. Il primo titolo principale diventa automaticamente `{{titolo}}`; le altre sezioni restano uguali. Le date già scritte rimangono letterali: sostituiscile con `{{data}}` se devono aggiornarsi a ogni nuova nota. I riferimenti alle immagini Markdown locali continuano a puntare agli stessi allegati, anche quando cambia la cartella della nuova nota.

## Proprietà facoltative (0.12.0)

Apri **Proprietà** nell’intestazione della nota. Tipo, categoria, stato, revisione e tag sono facoltativi e salvati nello stesso file Markdown. Il pannello è chiuso di default; **Nascondi proprietà** lo rimuove completamente dalla pagina. La scelta per nota è ricordata durante la sessione e una preferenza iniziale si trova in Impostazioni → Editor. Il lucchetto protegge anche questi campi.

I campi testuali si confermano con Invio o uscendo dal campo; i menu si confermano alla selezione. Cancellare un valore rimuove quella chiave YAML. Il corpo resta invariato, e aprire/nascondere il pannello non aggiunge proprietà. Scrivi e lettura non mostrano il frontmatter; Sorgente contiene sempre tutto il file. Proprietà avanzate, liste con commenti o chiavi duplicate restano disponibili in Sorgente senza riscritture automatiche.

I nuovi modelli iniziali usano proprietà strutturate. Le vecchie note e i vecchi modelli conservano il testo già presente; nessuna migrazione automatica.

## Foglio degli appunti veloci (0.12.0)

Premi **Nota veloce** (icona del taccuino nell’intestazione) da qualunque area dell’app, anche Impostazioni. In Concentrazione trovi lo stesso pulsante nella nota. L’editor è sempre vuoto, senza titolo o testo precompilato. Dopo **Aggiungi appunto**, il testo viene aggiunto in fondo ad **Appunti veloci.md** nella radice del Vault, con data e ora locali sopra ogni appunto. Non cambia la schermata in cui stavi lavorando.

Il file si crea alla prima cattura e puoi aprirlo dall’Explorer, dal messaggio di salvataggio o da **Apri foglio** nell’editor veloce vuoto. È una nota Markdown normale, modificabile e indicizzata. Gli appunti precedenti restano nel foglio; ogni nuova cattura è aggiunta sotto quelli esistenti. Se rinomini o sposti il foglio, il pulsante torna a usare il percorso fisso Appunti veloci.md e creerà un nuovo foglio quando necessario.

Un errore conserva il testo nel dialogo. Il pulsante di chiusura e Esc chiedono se scartare un appunto non salvato. I tentativi ripetuti dello stesso appunto usano un identificativo in commento Markdown, invisibile nella lettura. Se il foglio aperto ha modifiche, vengono salvate prima di aggiungere l’appunto; se c’è un conflitto, risolvilo nella nota. Il dialogo non è un backup persistente: lascia aperta l’app finché il salvataggio non riesce oppure copia il testo.

## Da appunto a nota o procedura (0.13.0)

Nel foglio **Appunti veloci**, apri **Organizza appunti** e scegli **Crea nota** o **Crea procedura** accanto al testo da sviluppare. Modifica il titolo proposto e scegli la cartella. La copia si apre per la modifica; il foglio originale resta intatto. La procedura include le sezioni del modello tecnico e, in fondo, **Appunto di partenza** con data e testo originali: compila tu i passaggi.

Il dialogo consente di cambiare da procedura a nota libera. In caso di nome già presente o errore, resta aperto: cambia nome o riprova. La copia conserva anche le modifiche attualmente presenti nell’editor del foglio e mantiene i riferimenti Markdown locali. Il pannello si può richiudere per continuare a scrivere normalmente.

## Corsivo e identificativi invisibili (0.13.1)

Entrambe le sintassi `*parola*` e `_parola_` indicano corsivo, senza spazi fra delimitatore e testo. Il pulsante Corsivo/Ctrl+I usa gli asterischi; non è necessario convertire le note scritte con underscore. I font di sistema privi di un carattere corsivo dedicato possono ora usare una variante inclinata sintetica nelle note. Lo stile è coerente in Scrivi e con pagina bloccata.

Ogni appunto veloce conserva un commento identificativo nel Markdown. È nascosto in Scrivi e lettura, ma rimane in Sorgente: serve alla distinzione delle catture e ai tentativi di salvataggio ripetuti. Non serve cancellarlo. I vecchi appunti beneficiano del cambiamento senza essere riscritti.

## Cartelle di servizio e centratura (0.14.0)

Le cartelle chiamate `attachments` sono nascoste nell’albero del Vault, inclusi i loro figli, ma restano sul disco e disponibili per le immagini nelle note. Scrivi mantiene la larghezza impostata e gli stessi margini centrati della lettura, anche dopo l’inserimento di una tabella.

# Architettura Nebula · 0.39.0

## Moduli e responsabilità

| Livello | Responsabilità |
| --- | --- |
| Shell e workspace | Navigazione, schede, visibilità dei pannelli, preferenze UI |
| Editor | Sessioni Markdown, CodeMirror, rendering, tabelle, proprietà, appunti e modelli |
| Strutture | Alberi liberi `nebula-tree` v1, categorie, oggetti e validazione |
| Configuratore | Definizioni, condizioni, misure, selezione, distinta e analisi |
| Knowledge e ricerca | Indici derivati dai file, risoluzione dei collegamenti e ricerca |
| Filesystem e storage | File reali del Vault; IndexedDB per handle, cache degli indici |
| Worker locali | Indicizzazione e calcolo delle configurazioni |

## Strutture 0.39.0

`src/features/trees/` tiene il formato, le operazioni e la vista. Un albero è un file `Strutture/<nome>.tree.json`, riconosciuto da `isTreePath`, letto con `parseTree` e scritto da `treeStore` con lo stesso ciclo del configuratore: sessione per percorso, autosalvataggio a 700 ms, validazione prima della scrittura, metadati attesi e conflitto esterno. `createTree` crea la cartella `Strutture/`. Lo stato di apertura, selezione e filtro sta in `treeUiStore` (`nebula.tree-ui.v1`), mai nel file. Le categorie effettive si calcolano a ogni lettura e non vengono salvate.

Il colore del nodo è isolato in `principalCategory`: è quello della prima categoria effettiva. Le icone degli oggetti stanno in `objectIcons.tsx` (tabella, caratteristica propria, caratteristica acquisita). `conformSuffix` e `freeSuffix` preparano la rinumerazione dello spostamento, che non è in questa versione: non ci sono trascinamento, «Sposta in…» né annullamento dell'ultimo spostamento. Un futuro spostamento potrà sostituire `parentId` e `order` e poi chiamare `edit`.

Nessun nuovo backend. I dati del progetto rimangono nei file del Vault.

## Configuratore e prova locale 0.26.0

`configuratorUiStore` conserva solo lo stato della vista nel localStorage, indicizzato per identità Vault e percorso. Selezioni e filtri non entrano nel file di definizione. Le preferenze malformate vengono normalizzate; uno storage non disponibile mantiene utilizzabile la sessione. Le definizioni cambiate ripuliscono gli ID non più presenti senza cancellare un numero fuori intervallo che l’utente deve correggere.

`definitionValidation` centralizza controlli inline e rilevazione delle dipendenze, includendo azioni, alternative, misure e selezionabilità. `DefinitionDialog` confronta la bozza iniziale per proteggere X/Esc. `CatalogFilters`, `ComponentSummary` e `RulePreview` separano ricerca, riepilogo e prova delle condizioni dalla modifica dei dati.

`testVault` carica pigramente fixture serializzate e crea file soltanto nella cartella OPFS dedicata, senza ricevere handle del Vault personale. File già presenti non vengono sovrascritti. `VaultService.openTestVault` riusa gli adapter reali di scansione, lettura e scrittura e i normali store dell’app. Il campione non sostituisce o simula il motore: BOM, grafi e regole usano lo stesso codice dei Vault personali.

## Shell e layout 0.25.0

`workspace/panelLayout.ts` identifica l'area visualizzata e valida esclusivamente preferenze booleane di layout. `workspaceStore` ripristina i pannelli al cambio di area e salva le scelte in `nebula.panel-layouts.v1` nel localStorage. Il contenuto dei documenti non viene copiato in questa preferenza. I valori non validi vengono ignorati; un localStorage non disponibile non impedisce l'uso durante la sessione.

`useShellPanels` definisce una sola regola di visibilità condivisa da shell e intestazione: nessun ispettore su Inizio o Impostazioni, dettagli del documento attivo soltanto quando pertinenti. `ContextPanel` ricava il file dalla scheda attiva e dallo snapshot, evitando selezioni obsolete dell'Explorer. Negli schermi stretti il cambio area non riapre l'ispettore sopra il contenuto; la navigazione può aprire il pannello sinistro richiesto.

`settingsStore` conserva la scelta della navigazione estesa insieme alle preferenze esistenti, senza migrazioni dei file. I token della densità riducono altezze e spaziatura delle impostazioni, mantenendo le dimensioni dei caratteri.

## Configuratore 0.25.0

`ConfiguratorView` coordina sessione, selezione e calcolo. `ConfiguratorNavigation` presenta Utilizzo, Definizione e Controlli senza introdurre schermate intermedie. `ConfiguratorResults` contiene presentazione ed esportazione di distinta e varianti. Il formato 6 aggiunge `Component.dimensions` e risultati per dimensione identificati da ID. `componentMeasure` centralizza normalizzazione delle misure legacy, conversioni, validazione e presentazione. Le varianti aggregano ogni dimensione separatamente; una misura variabile diventa indefinita senza nascondere quelle costanti. I file 1–5 restano leggibili e mantengono la misura singola finché non viene modificata nell’editor.

`workspace/saveStatus.ts` centralizza le etichette di salvataggio; la barra della shell e l'intestazione del configuratore derivano lo stato dalle rispettive sessioni. La connettività resta distinta dalla riuscita della scrittura locale.

## Sezioni rimosse (0.31.0)

Le sezioni principali Grafo e Lavagne non fanno più parte della navigazione, del workspace o delle impostazioni. Moduli, renderer, worker, persistenza applicativa e stili del grafo della conoscenza sono rimossi. Il grafo delle regole nel configuratore resta disponibile.

I collegamenti tra note, i backlink, la ricerca e gli indici rimangono attivi. I file Excalidraw esistenti sono trattati come allegati generici e non vengono cancellati. Le preferenze di layout delle vecchie sezioni sono ignorate; eventuali object store storici nel database locale rimangono inutilizzati, senza migrazioni distruttive degli archivi esistenti.

## Proprietà e cattura veloce (0.12.0)

`domain/noteProperties.ts` legge e modifica soltanto cinque chiavi YAML facoltative, preservando corpo e chiavi estranee. Nessun parser YAML generale o nuova dipendenza. Forme avanzate/ambigue delle chiavi gestite vengono bloccate nell’interfaccia e lasciate a Sorgente. `maskFrontmatter` conserva gli offset per indice titoli, tabelle, task e wikilink. Nel live editor una decorazione a blocco e una protezione delle transazioni preservano i metadati durante la modifica del corpo; la lettura usa soltanto il corpo Markdown.

La visibilità vive nella memoria editor per nota, con una preferenza persistita per il valore iniziale. Non viene salvata nel file. `quickNoteUiStore` apre il dialogo globale anche da Concentrazione. `quickNotes` gestisce il percorso fisso e la prima creazione attraverso VaultStore/VaultService. `appendDocumentText` coordina la cattura con buffer/autosalvataggi, rilettura del disco, metadati attesi e blocco temporaneo del solo documento destinatario. Il buffer cambia soltanto dopo una scrittura confermata. Un commento con UUID rende lo stesso tentativo idempotente dopo una conferma fallita.

## Sviluppo degli appunti veloci (0.13.0)

`quickNoteConversion.ts` riconosce le catture tramite intestazioni con data/ora e marker identificativi, preserva il corpo e riusa il modello Procedura tecnica. `QuickNoteOrganizer` legge la sessione corrente del foglio; passa una cattura immutabile a `VaultOperationDialog`, che riusa creazione e gestione collisioni del Vault. La conversione non scrive né rimuove la cattura originale. Il rebasing dei riferimenti Markdown riusa `preparePersonalTemplate` con sostituzione del titolo disabilitata.


### Parametri di testo e proprietà (0.28.0)

Il formato 7 aggiunge `Parameter.type = text` e `Component.properties` (ID, nome, ID parametro). `componentProperties` centralizza validazione, risoluzione delle selezioni e presentazione. I risultati BOM includono i valori per ID proprietà; le varianti aggregano i valori senza inventare un testo quando differiscono. `ComponentPropertiesEditor` gestisce la bozza, `ComponentPropertyValues` presenta la stessa proprietà in BOM, riepilogo e inspector.

I parametri testuali usati soltanto come proprietà sono esclusi dai domini aperti da enumerare. `parameterNeedsInput` distingue questo caso dai testi che partecipano a condizioni, azioni o selezionabilità; tali testi devono essere definiti o propagati dai vincoli. Le misure e le formule delle quantità continuano ad ammettere soltanto parametri numerici. `acceptsParameterValue` mantiene stringhe libere nel ripristino delle preferenze, preservando anche i numeri fuori intervallo per permetterne la correzione.


### Opzioni testuali e valori locali (0.29.0)

Il formato 8 aggiunge `Parameter.allowCustom` e `ComponentProperty.value`. L’assenza di allowCustom conserva il testo libero dei file precedenti; false rende `values` un dominio chiuso. `acceptsParameterValue`, il motore e i controlli dei vincoli condividono questa distinzione. Per i testi che descrivono soltanto proprietà, l’enumerazione non usa l’assenza del parametro nelle soluzioni come prova che un’opzione sia impossibile.

La presenza di value indica un valore autonomo della proprietà: il risolutore preferisce il valore locale alla selezione globale e l’editor permette testi locali anche fuori dalle opzioni BOM. Il cambio a Dalla BOM elimina value. `TextParameterInput` riusa un campo con suggerimenti per testi liberi e per la proprietà autonoma; gli elenchi chiusi usano i controlli delle scelte in Esplora e nei vincoli.


### Duplicazione del componente (0.30.0)

`duplicateComponent` crea una nuova definizione con codice univoco e identificativi nuovi per componente, dimensioni, proprietà, regole, alberi e alternative. Copia le regole che fanno riferimento al componente; mantiene i riferimenti ai parametri e alle dipendenze, remappa i riferimenti al componente originario e filtra le azioni add/exclude destinate ad altri componenti. Le alternative prive di azioni per la copia sono rimosse; le condizioni comuni e i vincoli rimangono associati alla copia. Le regole copiate sono consolidate con `mergeComponentRules`, senza passare da `commitRule` nella duplicazione, per conservare le definizioni originali.

L’azione nel menu di `ComponentEditor` esegue la modifica atomica di componenti/regole tramite lo store esistente e apre la copia in bozza per eventuale rinomina. Non duplica file del Vault e non cambia il formato dei dati.

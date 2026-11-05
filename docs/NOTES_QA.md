# Proprietà e appunti veloci — 0.12.0

## Verifiche automatiche

- Note standard senza proprietà: nessuna modifica aprendo/nascondendo il pannello; stato chiuso ricordato per nota nella sessione.
- Frontmatter: inserimento/rimozione dei cinque campi, codifica delle stringhe, preservazione del corpo, BOM/CRLF, alias e chiavi estranee. YAML ambiguo/avanzato, tag con commenti o virgole interne lasciati a Sorgente.
- Scrivi: frontmatter nascosto e protetto durante sostituzione dell’intero corpo; passaggio a Sorgente, offset dei titoli/task/link, cronologia Annulla/Ripristina. Lettura sanificata senza metadati.
- UI globale: cattura disponibile in file/grafi/lavagne/impostazioni; editor inizialmente vuoto anche alla cattura successiva; testo mantenuto dopo errore e scarto esplicito.
- Foglio: creazione iniziale reale, catture cumulative con data/ora locali, permanenza nella schermata corrente, conservazione delle modifiche manuali, rilettura degli aggiornamenti esterni, conflitti bloccanti, protezione del destinatario durante scrittura, invii duplicati bloccati e retry idempotente dopo conferma fallita.
- Suite Vitest completa: 143 test. TypeScript e build PWA verificati.

## Limiti di verifica

Le nuove prove Playwright usano un Vault OPFS isolato per catture da diverse aree e per proprietà salvate nel Markdown. L’avvio è stato tentato, ma Chromium non è installato: le prove non hanno potuto eseguire azioni nel browser. La verifica visiva desktop 1280/1920, narrow e dei temi resta da eseguire; jsdom verifica interazioni e DOM, non il layout. Il controllo del browser cloud previsto dal flusso Sites non è disponibile in questo ambiente.

## Verifica manuale successiva

1. Aprire una nota standard e verificare che il pannello non compaia. Aprire Proprietà, compilare categoria/tag, nascondere e cambiare scheda: il corpo deve restare identico e il pannello assente al ritorno.
2. Aprire una procedura da modello: proprietà compilate, nessuna duplicazione nel corpo. Verificare Scrivi, Sorgente, lettura bloccata e Annulla/Ripristina.
3. Creare appunti veloci da ricerca, grafo, lavagna, Impostazioni e Concentrazione. Ogni editor deve partire vuoto; il foglio deve conservare le catture precedenti e avere data/ora sopra ogni cattura.
4. Modificare manualmente il foglio aperto e poi catturare: entrambe le modifiche devono restare. Simulare un file non scrivibile o un conflitto esterno: testo mantenuto nel dialogo e nessuna sovrascrittura forzata.
5. Provare layout e temi a 1280, 1920 e 430 px; il pannello completamente nascosto non deve occupare spazio.

## Correzioni 0.13.1 — identificativi e corsivo

- 157 test Vitest in 32 file superati; TypeScript e build PWA completati.
- Nuove regressioni: identificativi nascosti in Scrivi anche con il cursore nel commento, presenti in Sorgente, file originale e conversione conservati; LF/CRLF e catture dopo un blocco di codice incompleto. Gli esempi letterali in codice e i commenti ordinari restano invariati.
- Entrambe le sintassi `*corsivo*` e `_corsivo_`, anche con grassetto, producono enfasi in Scrivi e lettura bloccata. I test caricano i CSS reali e verificano `font-style: italic` e `font-synthesis: style` nei due temi: la regola globale `font-synthesis: none` non impedisce più l'inclinazione nei font di sistema privi di un corsivo dedicato.
- Il test Playwright dedicato è stato avviato, ma si arresta prima delle interazioni perché manca l'eseguibile Chromium. Non sono stati acquisiti screenshot né verificati i glifi in un browser reale. Da confermare su Windows: corsivo visibile in entrambi i temi, identificativi assenti in Scrivi e lettura, passaggio a Sorgente e aggiornamento della PWA.

## Tabelle, attachments e centratura — 0.14.0

- Suite completa: **170 test in 33 file superati**. TypeScript e build PWA completati; controllo diff senza errori.
- Albero Vault: cartelle attachments di radice/annidate nascoste, contatori corretti, dati originali e figli conservati. Adapter e risoluzione delle immagini invariati; le prove esistenti sui riferimenti locali passano.
- Parser/serializzazione: unioni e larghezze nello stesso Markdown, allineamento conservato, LF/CRLF e offset del blocco successivo, tabelle standard e codice letterale. Metadati invalidi, fuori griglia, sovrapposti o tra intestazione/corpo ignorati senza nascondere valori.
- Interazioni reali del componente in jsdom: selettori/Shift+clic e selezione multipla, unione rettangolare, divisione con ripristino dei testi, valore unito modificato senza contenuti nascosti, ridimensionamento via pointer e tastiera, salvataggio/riapertura, annullamento del dialogo. Cambi strutturali aggiornano le unioni e le larghezze.
- Scrivi/lettura: celle unite con contenuto formattato sanificato, colgroup e larghezze numeriche, commento interno nascosto, modifica CodeMirror con Annulla/Ripristina. Tabelle HTML raw non possono impersonare gli indici delle tabelle Markdown. La verifica CSS carica i fogli effettivi e controlla `flex-grow: 0` e margini automatici di Scrivi nei temi chiaro/scuro; jsdom non misura il layout in pixel.
- Browser plugin e skill control-browser non disponibili. Avviato il test Playwright dedicato con Vault OPFS isolato: arrestato prima delle interazioni per eseguibile Chromium mancante. Restano da eseguire screenshot e controlli visivi 1280/1920/430 px, drag reale, larghezza e centratura confrontate con lettura, immagini locali dopo occultamento attachments e aggiornamento PWA. Nessuno screenshot acquisito né risultato E2E positivo dichiarato.

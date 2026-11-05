# Nebula — PWA e Offline

## Obiettivo

Nebula deve essere installabile come PWA e avviabile senza connessione dopo che gli asset dell'app sono stati memorizzati.

## Service Worker

Cache solo delle risorse dell'app:

- HTML shell;
- JS/CSS bundle;
- icone;
- font locali eventualmente inclusi;
- risorse statiche necessarie.

Non usare la Cache API del service worker come archivio principale delle note.

## Update flow

Evitare aggiornamenti improvvisi mentre l'utente sta scrivendo.

Flusso consigliato:

1. nuovo service worker disponibile;
2. banner discreto `Aggiornamento disponibile`;
3. pulsante `Aggiorna`;
4. prima del reload verificare e salvare documenti dirty;
5. attivare il nuovo SW e ricaricare.

## Manifest

Minimo:

- `name`: Nebula
- `short_name`: Nebula
- `display`: standalone
- `start_url`: `/`
- theme/background color coerenti col tema startup
- icone maskable e standard

## Offline

Quando offline:

- apertura app: deve funzionare;
- accesso al Vault locale: continua se i permessi/browser lo consentono;
- editor, ricerca, link, grafo e lavagna devono continuare a funzionare;
- nessuna feature P0 deve richiedere CDN.

## Dipendenze

Le dipendenze runtime devono essere incluse nel bundle, non caricate da CDN.

## Install prompt

Non mostrare prompt invasivi. Aggiungere `Installa Nebula` in un menu App/Settings quando il browser rende disponibile l'evento appropriato.

# Nebula — Regole operative per Codex

Questo documento è prescrittivo.

## 1. Fonte di verità

Leggere prima `00_README.md` e `NEBULA_MASTER_SPEC.md`.

Se una richiesta successiva dell'utente contraddice questi documenti, la richiesta più recente prevale e la documentazione deve essere aggiornata.

## 2. Non cambiare il modello dati senza necessità

Le note restano file `.md` reali nel Vault.

Le lavagne restano file del Vault.

IndexedDB è una cache/stato locale ricostruibile, non la fonte unica dei contenuti.

## 3. Nessun backend per le funzioni core

Non aggiungere:

- database remoto;
- autenticazione;
- Firebase/Supabase;
- API server;
- upload cloud;

senza richiesta esplicita.

## 4. File System Access

L'accesso file deve essere incapsulato in un adapter.

Non scrivere mai fuori dal directory handle scelto dall'utente.

Gestire esplicitamente:

- permesso mancante;
- file scomparso;
- write failure;
- conflitto modifica esterna;
- path invalidi.

## 5. UI

Seguire `03_UX_UI_DESIGN_SYSTEM.md`.

Non introdurre framework grafici che cambiano radicalmente l'identità senza motivo.

Ogni nuova funzione deve avere:

- stato normale;
- hover/focus;
- disabled se applicabile;
- loading/progress se operazione lunga;
- empty state;
- error state.

## 6. Accessibilità

- keyboard navigation;
- focus visibile;
- ARIA dove necessaria;
- contrasto adeguato;
- target touch adeguati;
- non affidarsi solo al colore.

## 7. Performance

Digitazione editor e drag della lavagna hanno priorità assoluta.

Non eseguire scansione Vault, parse massivo o layout grafo sul main thread se può produrre lag percepibile.

## 8. Modifiche incrementali

Lavorare per milestone.

Per ogni milestone:

1. implementare solo lo scope definito;
2. eseguire test;
3. correggere regressioni;
4. aggiornare documentazione se il comportamento cambia;
5. produrre un breve changelog.

## 9. Test

Non considerare una feature terminata solo perché compila.

Eseguire almeno:

- test unitari per parser/link/path;
- test integrazione per store/adapters;
- E2E per flussi critici;
- controllo manuale desktop del layout.

## 10. Grafo allegato

Il progetto `ConfigApp` allegato è un riferimento utile soprattutto per:

- separazione layout/UI;
- fisica;
- adaptive spacing;
- drag/manual positions;
- collision/settling;
- impostazioni grafo.

NON riutilizzare come modello semantico:

- `parentId` come relazione primaria;
- `level` statico di ogni nota;
- nodi demo hard-coded;
- localStorage come storage delle note.

## 11. Dipendenze

Prima di aggiungere una dipendenza:

- verificare che sia attivamente mantenuta;
- preferire API stabili;
- evitare doppioni;
- evitare CDN runtime;
- verificare impatto bundle.

## 12. Sicurezza

- sanificare HTML;
- evitare `dangerouslySetInnerHTML` senza sanitizzazione;
- bloccare traversal `..`;
- normalizzare path;
- nessuna esecuzione di script dal Markdown;
- nessun contenuto del Vault inviato in rete.

## 13. Definition of Done

Una milestone è completata quando:

- acceptance criteria soddisfatti;
- test verdi;
- nessun errore console critico;
- nessuna perdita dati nei test manuali;
- light/dark verificati se tocca UI;
- layout 1280 px e 1920 px verificato;
- documentazione aggiornata.

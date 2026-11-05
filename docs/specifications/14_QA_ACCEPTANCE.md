# Nebula — QA e Acceptance Criteria

## Vault

- [ ] Apri cartella da gesture utente.
- [ ] Permesso negato gestito senza crash.
- [ ] Riapertura handle salvato.
- [ ] Cartella con 0 note mostra empty state.
- [ ] Cartella con sottocartelle profonde viene letta correttamente.
- [ ] Cartelle ignorate non vengono indicizzate.

## File operations

- [ ] Crea `.md`.
- [ ] Impedisce nomi/path invalidi.
- [ ] Rinomina file senza perdita contenuto.
- [ ] Move cross-folder.
- [ ] Delete con conferma.
- [ ] Fallimento in metà operazione non elimina l'originale prematuramente.

## Editor

- [ ] Nessun lag evidente durante digitazione lunga.
- [ ] Auto-save.
- [ ] Ctrl/Cmd+S.
- [ ] Dirty state.
- [ ] Failure mantiene buffer.
- [ ] Reopen mostra contenuto reale disco.
- [ ] Preview sanificata.

## Link

- [ ] `[[Nota]]` risolve.
- [ ] `[[Folder/Nota]]` risolve.
- [ ] alias funziona.
- [ ] unresolved visibile.
- [ ] creazione da unresolved.
- [ ] backlinks aggiornati.
- [ ] ambiguità gestita.

## Search

- [ ] trova per basename.
- [ ] trova per path.
- [ ] trova nel contenuto.
- [ ] indice si aggiorna dopo modifica.
- [ ] nessun blocco UI durante reindex grande.

## Graph

- [ ] nodo per documento indicizzato previsto.
- [ ] edge corrisponde a link reale.
- [ ] click apre nota.
- [ ] pan/zoom fluidi.
- [ ] fit funziona.
- [ ] filtro aggiorna senza reload.
- [ ] local graph depth corretta.
- [ ] drag pin non provoca salti estremi.
- [ ] label leggibili a zoom normale.

## Whiteboard

- [ ] crea file.
- [ ] riapre stessa scena.
- [ ] autosave non scrive per ogni pointer move.
- [ ] theme sync.
- [ ] link a nota persistente.
- [ ] grafo riceve board-link.

## PWA

- [ ] installabile in browser target.
- [ ] avvio standalone.
- [ ] offline app shell funziona.
- [ ] update disponibile non forza reload durante editing.

## UI

- [ ] Dark.
- [ ] Light.
- [ ] 1280x720.
- [ ] 1920x1080.
- [ ] focus keyboard visibile.
- [ ] sidebar/right panel collassabili.
- [ ] drag tab fluido.
- [ ] no overflow inattesi.

## Regressioni critiche

Qualsiasi bug che può causare perdita o sovrascrittura involontaria di file è **release blocker**.

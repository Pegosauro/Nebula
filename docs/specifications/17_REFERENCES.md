# Nebula — References

Riferimenti da usare per verificare API e comportamenti durante l'implementazione.

## File System Access / File System API

- MDN — `showDirectoryPicker()`  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker

- MDN — File System API  
  https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

- MDN — `FileSystemHandle.queryPermission()`  
  https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission

- MDN — `FileSystemHandle.requestPermission()`  
  https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission

- web.dev — Open a directory / File System Access  
  https://web.dev/articles/files/open-a-directory

## Browsidian

Progetto di riferimento per l'accesso Browser Mode a un Vault locale:

https://github.com/blamouche/browsidian

Elementi utili da osservare:

- folder picker;
- Browser Mode;
- Markdown file tree;
- autosave;
- wikilink;
- local-first behavior.

## Excalidraw

- Developer docs  
  https://docs.excalidraw.com/

## Obsidian compatibility reference

- Obsidian Help  
  https://help.obsidian.md/

Usare la documentazione per verificare la sintassi desiderata di wikilink, embed, properties e Markdown extensions. Nebula non deve dipendere dal runtime Obsidian.

## App grafo allegata

Archivio fornito nel task iniziale:

```text
ConfigApp (1).zip
```

File principali:

```text
ConfigApp/src/graphLayout.js
ConfigApp/src/graphProject.js
ConfigApp/src/App.jsx
ConfigApp/src/NodeTree.jsx
ConfigApp/src/styles.css
```

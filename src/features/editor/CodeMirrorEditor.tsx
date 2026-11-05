import { frontmatterRange } from "../../domain/noteProperties";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { autocompletion, closeCompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { history, historyKeymap, defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxTree, bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, StateEffect } from "@codemirror/state";
import { drawSelection, dropCursor, EditorView, highlightSpecialChars, keymap, lineNumbers, placeholder } from "@codemirror/view";
import type { KnowledgeSuggestion } from "../../domain/knowledge";
import { withoutMarkdownExtension } from "../../domain/path";
import { parseWikilinks } from "../../infrastructure/markdown/parseKnowledge";
import { editorCacheGeneration, getEditorMemory, rememberEditor } from "./editorSessionCache";
import { createEditorApi, editorUiState, type EditorApi, type EditorPanel, type EditorUiState } from "./editorCommands";
import { createLiveMarkdown, revealMarkdownAtCursor } from "./liveMarkdown";
import { headingEntries, minimalChange, parseTsv, serializeTable, type MarkdownTable, type FormatAction } from "./markdownTools";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { renderedLinkHref } from "./noteLinkTarget";
import { insertCommands } from "./insertCommands";
import { documentText } from "./markdownAnalysis";

interface Props {
  path: string; value: string; source: boolean; visible: boolean; readOnly?: boolean; appearanceKey?: string; showMarkdownAtCursor?: boolean;
  onChange: (value: string) => void; onSave: () => void; onOpenLink: (target: string) => void;
  suggestions: KnowledgeSuggestion[]; apiRef: RefObject<EditorApi | null>;
  onUiChange: (state: EditorUiState) => void; onPanel: (panel: EditorPanel) => void;
  onTable?: (table: MarkdownTable) => void;
  onImages: (files: File[]) => void;
}
export default function CodeMirrorEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null), viewRef = useRef<EditorView | null>(null);
  const current = useRef(props); current.current = props;
  const modeConfig = useRef(new Compartment());
  const syntaxConfig = useRef(new Compartment());
  const accessConfig = useRef(new Compartment());
  const sourceExtensions = () => [lineNumbers(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }), bracketMatching()];
  const accessExtensions = (readOnly = false) => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly), EditorView.contentAttributes.of({ "aria-readonly": String(readOnly) })];
  const live = useMemo(() => createLiveMarkdown(props.path, table => { if (!current.current.readOnly) current.current.onTable?.(table); }, target => current.current.onOpenLink(target)), [props.path]);
  const syncing = useRef(false);
  const lastValue = useRef(props.value);
  const configuredMode = useRef(props.source), configuredReadOnly = useRef(!!props.readOnly);
  const scrolling = useRef(getEditorMemory(props.path)?.scrollTop ?? 0);
  useEffect(() => {
    if (!host.current) return;
    const epoch = editorCacheGeneration(); const path = props.path;
    lastValue.current = props.value; configuredMode.current = props.source; configuredReadOnly.current = !!props.readOnly;
    let alive = true;
    const complete = (context: CompletionContext): CompletionResult | null => {
      if (context.state.readOnly) return null;
      const link = context.matchBefore(/\[\[[^\]\n|]*/u);
      if (link) return {
        from: link.from + 2,
        options: current.current.suggestions.flatMap(s => [s.label, ...s.aliases].map(label => ({
          label, detail: withoutMarkdownExtension(s.path), type: "text",
          apply(view: EditorView, _completion: unknown, from: number, to: number) {
            const tail = view.state.sliceDoc(to, to + 2); const close = tail.startsWith("]]" ) ? 2 : tail.startsWith("]") ? 1 : 0;
            const target = withoutMarkdownExtension(s.path); const text = `${target}${label !== s.label ? `|${label}` : ""}]]`;
            view.dispatch({ changes: { from, to: to + close, insert: text }, selection: { anchor: from + text.length }, userEvent: "input.complete" });
          },
        }))), validFor: /^[^\]\n|]*$/u,
      };
      const slash = context.matchBefore(/\/[\p{L}\d -]*$/u);
      if (!slash || slash.from !== context.state.doc.lineAt(slash.from).from) return null;
      return { from: slash.from, filter: false, options: insertCommands.filter(c => `${c.label} ${c.keywords}`.toLocaleLowerCase().includes(slash.text.slice(1).toLocaleLowerCase())).map(c => ({ label: c.label, detail: c.group, type: "keyword", apply(view: EditorView, _completion: unknown, from: number, to: number) {
        view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from }, userEvent: "input.complete" });
        closeCompletion(view);
        if (c.panel) current.current.onPanel(c.panel);
        else if (c.format) current.current.apiRef.current?.format(c.format);
        else if (c.text) current.current.apiRef.current?.insert(c.text, true);
      } })) };
    };
    const format = (action: FormatAction) => () => { current.current.apiRef.current?.format(action); return true; };
    const panel = (target: EditorPanel) => () => { if (!current.current.readOnly) current.current.onPanel(target); return true; };
    const notify = (view: EditorView) => {
      if (!alive) return;
      const state = editorUiState(view);
      current.current.onUiChange(state);
      if (state.from !== state.to) view.requestMeasure({ read: v => v.coordsAtPos(v.state.selection.main.head), write: rect => {
        if (alive && rect) current.current.onUiChange({ ...editorUiState(view), x: rect.left, y: rect.top });
      } });
    };
    const openDestination = (editor: EditorView, href: string) => {
      if (/^(https?:|mailto:)/i.test(href)) { window.open(href, "_blank", "noopener,noreferrer"); return true; }
      if (href.startsWith("#")) {
        try {
          const name = decodeURIComponent(href.slice(1)).replaceAll("-", " ").toLocaleLowerCase();
          const heading = headingEntries(documentText(editor.state.doc)).find(item => item.text.toLocaleLowerCase() === name);
          if (heading) current.current.apiRef.current?.select(heading.from);
        } catch { /* Malformed URL. */ }
        return true;
      }
      if (/(?:\.md|\.config\.json)(?:#|$)/i.test(href)) {
        try { current.current.onOpenLink(resolveImagePath(path, href.split("#")[0]!).replace(/\.md$/i, "")); } catch { /* Invalid relative path. */ }
        return true;
      }
      return false;
    };
    const openAt = (editor: EditorView, pos: number) => {
      const link = parseWikilinks(documentText(editor.state.doc)).find(item => pos >= item.start && pos <= item.end);
      if (link) { current.current.onOpenLink(link.target); return true; }
      for (let node = syntaxTree(editor.state).resolveInner(pos, 1); node; node = node.parent!) {
        const url = ["Link", "Autolink"].includes(node.name) ? node.getChild("URL") : node.name === "URL" ? node : null;
        if (url) return openDestination(editor, renderedLinkHref(editor.state.sliceDoc(url.from, url.to)));
      }
      return false;
    };
    type ClickLink = { target?: string; href?: string; x: number; y: number; at: number };
    let pressedLink: ClickLink | undefined;
    const linkElement = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>("[data-live-target],[data-live-href]") : null;
    const follow = (editor: EditorView, link: Pick<ClickLink, "target" | "href">) => {
      if (link.target) { current.current.onOpenLink(link.target); return true; }
      return link.href ? openDestination(editor, link.href) : false;
    };
    const extensions = [
      modeConfig.current.of(props.source ? sourceExtensions() : [live, EditorView.editorAttributes.of({ class: "is-live" })]),
      accessConfig.current.of(accessExtensions(props.readOnly)),
      syntaxConfig.current.of(revealMarkdownAtCursor.of(props.showMarkdownAtCursor ?? true)),
      EditorState.transactionFilter.of(transaction => {
        if (!transaction.docChanged || syncing.current || current.current.source || transaction.isUserEvent("undo") || transaction.isUserEvent("redo")) return transaction;
        const end = frontmatterRange(documentText(transaction.startState.doc))?.end ?? 0;
        if (!end) return transaction;
        const changes: Array<{ from: number; to: number; insert: string }> = [];
        let protectedChange = false;
        transaction.changes.iterChanges((from, to, _a, _b, insert) => {
          if (from < end) {
            protectedChange = true;
            if (to >= end) changes.push({ from: end, to, insert: insert.toString() });
          } else changes.push({ from, to, insert: insert.toString() });
        });
        return protectedChange ? { changes, userEvent: "input" } : transaction;
      }),
      EditorState.transactionFilter.of(transaction => transaction.startState.readOnly && transaction.docChanged && !syncing.current ? [] : transaction),
      highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
      markdown({ base: markdownLanguage }),
      autocompletion({ override: [complete], activateOnTyping: true }), EditorState.tabSize.of(2), EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": "Testo della nota", "aria-multiline": "true", role: "textbox", spellcheck: "true" }),
      placeholder("Inizia a scrivere… Usa / per inserire un elemento"),
      keymap.of([
        { key: "Mod-Enter", run: editor => openAt(editor, editor.state.selection.main.head) },
        { key: "Mod-s", run: () => { current.current.onSave(); return true; } },
        { key: "Mod-b", run: format("bold") }, { key: "Mod-i", run: format("italic") }, { key: "Mod-Shift-x", run: format("strike") },
        { key: "Mod-Shift-h", run: format("highlight") }, { key: "Mod-Shift-c", run: format("inlineCode") },
        { key: "Mod-k", run: panel("link") }, { key: "Mod-f", run: panel("search") }, { key: "Mod-h", run: panel("search") },
        { key: "Mod-Shift-p", run: panel("insert") }, { key: "F1", run: panel("help") },
        ...[1,2,3,4,5,6].map(n => ({ key: `Mod-Alt-${n}`, run: format(`h${n}` as FormatAction) })),
        indentWithTab, ...defaultKeymap, ...historyKeymap,
      ]),
      EditorView.domEventHandlers({
        pointerdown(event) {
          pressedLink = undefined;
          if (event.button !== 0 || event.altKey || event.shiftKey || current.current.source) return false;
          const element = linkElement(event.target);
          if (element) pressedLink = { target: element.dataset.liveTarget, href: element.dataset.liveHref, x: event.clientX, y: event.clientY, at: Date.now() };
          return false;
        },
        pointermove(event) {
          if (pressedLink && Math.hypot(event.clientX - pressedLink.x, event.clientY - pressedLink.y) > 6) pressedLink = undefined;
          return false;
        },
        pointercancel() { pressedLink = undefined; return false; },
        pointerup(event, editor) {
          const link = pressedLink; pressedLink = undefined;
          if (!link || event.button !== 0 || event.altKey || event.shiftKey || Date.now() - link.at > 500 || Math.hypot(event.clientX - link.x, event.clientY - link.y) > 6 || !editor.state.selection.main.empty) return false;
          const opened = follow(editor, link); if (opened) event.preventDefault(); return opened;
        },
        click(event, editor) {
          if (event.detail !== 0 || event.altKey || event.shiftKey || !editor.state.selection.main.empty) return false;
          const element = linkElement(event.target); if (!element) return false;
          const opened = follow(editor, { target: element.dataset.liveTarget, href: element.dataset.liveHref });
          if (opened) event.preventDefault(); return opened;
        },
        mousedown(event, editor) {
          if (!current.current.source || !(event.metaKey || event.ctrlKey)) return false;
          const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY }); if (pos === null) return false;
          const opened = openAt(editor, pos); if (opened) event.preventDefault(); return opened;
        },
        paste(event, editor) {
          if (editor.state.readOnly) { event.preventDefault(); return true; }
          const images = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"));
          if (images.length) { event.preventDefault(); current.current.onImages(images); return true; }
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (text.includes("\t") && /<table[\s>]/i.test(event.clipboardData?.getData("text/html") ?? "")) {
            event.preventDefault(); current.current.apiRef.current?.insert(serializeTable(parseTsv(text)), true); return true;
          }
          const selection = editor.state.selection.main;
          if (!selection.empty && /^https?:\/\/\S+$/i.test(text)) {
            event.preventDefault(); current.current.apiRef.current?.insert(`[${editor.state.sliceDoc(selection.from, selection.to).replace(/([\[\]\\])/g, "\\$1")}](${text.replace(/[()]/g, c => encodeURIComponent(c))})`); return true;
          }
          return false;
        },
        drop(event, editor) {
          if (editor.state.readOnly) { event.preventDefault(); return true; }
          const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith("image/"));
          if (!files.length) return false;
          event.preventDefault(); const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) editor.dispatch({ selection: { anchor: pos } });
          current.current.onImages(files); return true;
        },
        scroll(_event, view) { if (current.current.visible) scrolling.current = view.scrollDOM.scrollTop; if (view.state.selection.main.empty) return; current.current.onUiChange(editorUiState(view)); },
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !syncing.current) {
          lastValue.current = documentText(update.state.doc);
          current.current.onChange(lastValue.current);
        }
        if (update.docChanged || update.selectionSet) notify(update.view);
      }),
    ];
    const memory = getEditorMemory(path);
    let state = memory?.state?.update({ effects: StateEffect.reconfigure.of(extensions) }).state ?? EditorState.create({ doc: props.value, extensions });
    // CodeMirror offsets use one character per newline, including for CRLF files.
    const normalizedValue = props.value.replace(/\r\n?/g, "\n");
    if (documentText(state.doc) !== normalizedValue) state = state.update({ changes: minimalChange(documentText(state.doc), normalizedValue), filter: false }).state;
    const bodyStart = props.source ? 0 : frontmatterRange(documentText(state.doc))?.end ?? 0;
    if (state.selection.main.head < bodyStart) state = state.update({ selection: { anchor: bodyStart } }).state;
    const view = new EditorView({ parent: host.current, state }); viewRef.current = view;
    props.apiRef.current = createEditorApi(view);
    if (memory?.scrollTop) view.scrollDOM.scrollTop = memory.scrollTop;
    if (props.visible) view.focus(); notify(view);
    return () => {
      alive = false;
      rememberEditor(path, { state: view.state, scrollTop: scrolling.current }, epoch);
      props.apiRef.current = null; viewRef.current = null; view.destroy();
    };
  }, [props.path]);
  useEffect(() => {
    const view = viewRef.current; if (!view || lastValue.current === props.value) return;
    lastValue.current = props.value;
    syncing.current = true;
    view.dispatch({ changes: minimalChange(documentText(view.state.doc), props.value.replace(/\r\n?/g, "\n")) });
    syncing.current = false;
  }, [props.value]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || configuredMode.current === props.source) return;
    configuredMode.current = props.source;
    const bodyStart = props.source || !view ? 0 : frontmatterRange(documentText(view.state.doc))?.end ?? 0;
    view?.dispatch({ ...(view.state.selection.main.head < bodyStart ? { selection: { anchor: bodyStart } } : {}), effects: modeConfig.current.reconfigure(props.source ? sourceExtensions() : [live, EditorView.editorAttributes.of({ class: "is-live" })]) });
  }, [props.source]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || configuredReadOnly.current === !!props.readOnly) return;
    configuredReadOnly.current = !!props.readOnly;
    view?.dispatch({ effects: accessConfig.current.reconfigure(accessExtensions(props.readOnly)) });
    if (view && props.readOnly) closeCompletion(view);
  }, [props.readOnly]);
  useEffect(() => {
    const view = viewRef.current;
    if (props.visible && view) {
      const top = scrolling.current;
      view.focus();
      view.requestMeasure({ read: () => top, write: value => { if (viewRef.current === view) view.scrollDOM.scrollTop = value; } });
    }
  }, [props.visible]);
  useEffect(() => {
    const view = viewRef.current, enabled = props.showMarkdownAtCursor ?? true;
    if (view && view.state.facet(revealMarkdownAtCursor) !== enabled) view.dispatch({ effects: syntaxConfig.current.reconfigure(revealMarkdownAtCursor.of(enabled)) });
  }, [props.showMarkdownAtCursor]);
  useEffect(() => { viewRef.current?.requestMeasure(); }, [props.appearanceKey]);
  return <div className="codemirror-host" ref={host} />;
}

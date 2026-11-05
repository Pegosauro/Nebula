import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { useVaultStore } from "../vault/vaultStore";
import { taskMarkers } from "./markdownTasks";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Eye } from "lucide-react";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { vaultService } from "../vault/vaultService";
import { getEditorMemory, rememberEditor, editorCacheGeneration } from "./editorSessionCache";
import { headingEntries, markdownTables, type MarkdownTable } from "./markdownTools";

export default function MarkdownPreview({ content, sourcePath, onChange, onTable, onTaskToggle, readOnly = false }: { onTaskToggle?: (from: number, checked: boolean, expectedContent: string) => void; readOnly?: boolean; content: string; sourcePath: string; onChange?: (value: string) => void; onTable?: (table: MarkdownTable) => void }) {
  const revision = useKnowledgeStore(state => state.revision), activate = useKnowledgeNavigationStore(state => state.activate);
  const host = useRef<HTMLElement>(null);
  const focusedTask = useRef<number | undefined>(undefined);
  const vaultRevision = useVaultStore(state=>state.snapshot?.scannedAt);
  const preview = useMemo(() => renderMarkdownSafe(content, navigationKnowledge()), [content, revision, vaultRevision]);
  const html = useMemo(() => ({ __html: preview }), [preview]);
  const tasks = useMemo(() => taskMarkers(content), [content]);
  const tables = useMemo(() => markdownTables(content), [content]);
  const headings = useMemo(() => headingEntries(content), [content]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const epoch = editorCacheGeneration(); element.scrollTop = getEditorMemory(sourcePath)?.previewScroll ?? 0;
    return () => rememberEditor(sourcePath, { previewScroll: element.scrollTop }, epoch);
  }, [sourcePath]);
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    if (readOnly) { element.querySelectorAll<HTMLInputElement>("input,textarea,select,button").forEach(control => { control.disabled = true; }); }
    // Only Markdown task-list inputs, never arbitrary HTML controls.
    element.querySelectorAll<HTMLInputElement>('input[data-nebula-task][type="checkbox"]').forEach(input => {
      const index = Number(input.dataset.nebulaTask);
      input.disabled = !tasks[index] || !(onTaskToggle || (!readOnly && onChange));
      if (input.disabled) { delete input.dataset.taskIndex; return; }
      input.dataset.taskIndex = String(index);
      input.setAttribute("aria-label", `${input.checked ? "Segna da fare" : "Completa"}: ${input.closest("li")?.textContent?.trim() ?? "Attività"}`);
    });
    if (focusedTask.current !== undefined) {
      element.querySelector<HTMLInputElement>(`input[data-task-index="${focusedTask.current}"]`)?.focus({ preventScroll: true });
      focusedTask.current = undefined;
    }
    element.querySelectorAll<HTMLTableElement>("table[data-nebula-table]").forEach((table) => {
      const index = Number(table.dataset.nebulaTable);
      if (readOnly || !tables[index] || !onTable || table.querySelector("caption")) return;
      const caption = document.createElement("caption"), button = document.createElement("button");
      button.type = "button"; button.textContent = "Modifica tabella"; button.dataset.tableIndex = String(index); caption.append(button); table.prepend(caption);
    });
    element.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((heading, index) => {
      if (headings[index]) heading.dataset.headingFrom = String(headings[index].from);
    });
  }, [preview, tasks, tables, headings, onChange, onTable, onTaskToggle, readOnly]);
  useEffect(() => { if (readOnly) host.current?.focus({ preventScroll: true }); }, [readOnly, sourcePath]);
  useEffect(() => {
    let cancelled = false; const urls: string[] = [];
    for (const placeholder of host.current?.querySelectorAll<HTMLElement>("[data-nebula-image]") ?? []) {
      void (async () => {
        try {
          const path = resolveImagePath(sourcePath, placeholder.dataset.nebulaImage!);
          const blob = await vaultService.readImage(path); if (cancelled) return;
          const url = URL.createObjectURL(blob); urls.push(url);
          const img = document.createElement("img"); img.src = url; img.alt = placeholder.getAttribute("aria-label") ?? ""; img.loading = "lazy";
          placeholder.replaceChildren(img); placeholder.classList.add("is-loaded");
        } catch {
          if (!cancelled) { placeholder.textContent = `Immagine non disponibile: ${placeholder.dataset.nebulaImage}`; placeholder.classList.add("image-error"); }
        }
      })();
    }
    return () => { cancelled = true; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [preview, sourcePath]);
  return <article ref={host} tabIndex={readOnly ? 0 : undefined} aria-label={readOnly ? "Nota in sola lettura" : undefined} onKeyDown={event => {
    if (readOnly && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault(); const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(host.current!.firstElementChild ?? host.current!); selection?.removeAllRanges(); selection?.addRange(range);
    }
  }} className={`markdown-preview ${content.trim() ? "" : "is-empty"}`} onClick={event => {
    const target = event.target as HTMLElement;
    const input = target.closest<HTMLInputElement>("input[data-task-index]");
    if (input) {
      const task = tasks[Number(input.dataset.taskIndex)];
      if (task && !input.disabled) {
        focusedTask.current = Number(input.dataset.taskIndex);
        if (onTaskToggle) onTaskToggle(task.from, input.checked, content);
        else if (!readOnly) onChange?.(content.slice(0, task.from + 1) + (input.checked ? "x" : " ") + content.slice(task.from + 2));
      }
      return;
    }
    const tableButton = target.closest<HTMLElement>("[data-table-index]");
    if (tableButton) { const table = tables[Number(tableButton.dataset.tableIndex)]; if (table && !readOnly) onTable?.(table); return; }
    const link = target.closest<HTMLAnchorElement>("a"); if (!link) return;
    if (link.dataset.nebulaTarget) { event.preventDefault(); activate(sourcePath, link.dataset.nebulaTarget); return; }
    const href = link.getAttribute("href") ?? "";
    if (/^(https?:|mailto:)/i.test(href)) return;
    event.preventDefault();
    if (href.startsWith("#")) {
      let name = ""; try { name = decodeURIComponent(href.slice(1)).replaceAll("-", " ").toLocaleLowerCase(); } catch { return; }
      const heading = [...host.current!.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")].find(h => h.textContent?.toLocaleLowerCase() === name);
      heading?.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (/(?:\.md|\.config\.json)(?:#|$)/i.test(href)) {
      try { activate(sourcePath, resolveImagePath(sourcePath, href.split("#")[0]!).replace(/\.md$/i, "")); } catch { /* invalid local path */ }
    }
  }}>
    {content.trim() ? <div dangerouslySetInnerHTML={html} /> : <><Eye size={28} /><strong>Niente da visualizzare</strong><span>Inizia a scrivere per vedere la nota.</span></>}
  </article>;
}

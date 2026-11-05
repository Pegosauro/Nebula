import { isConfiguratorPath, configTitle, parseConfigurator } from "../configurator/model";
import { useConfiguratorStore } from "../configurator/configuratorStore";
import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FileText, LoaderCircle } from "lucide-react";
import { basename, withoutMarkdownExtension } from "../../domain/path";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { vaultService } from "../vault/vaultService";
import { useDocumentStore } from "./documentStore";
import { noteLinkSelector, noteLinkTarget } from "./noteLinkTarget";

type Preview = { title: string; path?: string; content?: string; message?: string; loading?: boolean; left: number; top: number; above: boolean; maxHeight: number };
export function NoteLinkPreview({ sourcePath, root }: { sourcePath: string; root: RefObject<HTMLElement | null> }) {
  const [preview, setPreview] = useState<Preview>();
  const card = useRef<HTMLDivElement>(null), keep = useRef<() => void>(() => {}), leave = useRef<() => void>(() => {});
  const id = useId();
  const draft = useDocumentStore(state => preview?.path ? state.sessions[preview.path] : undefined);
  const revision = useKnowledgeStore(state => state.revision);
  const html = useMemo(() => {
    const source = draft?.loaded ? draft.content : preview?.content;
    if (source === undefined) return "";
    const template = document.createElement("template");
    template.innerHTML = renderMarkdownSafe(source.slice(0, 6000), navigationKnowledge(), { omitMedia: true });
    // The card is an excerpt, with no active controls, media downloads or nested navigation.
    template.content.querySelectorAll("img,video,audio,source,[data-nebula-image],button,input,textarea,select").forEach(node => node.remove());
    template.content.querySelectorAll("a").forEach(link => { const span = document.createElement("span"); span.className = "note-preview-link"; span.textContent = link.textContent; link.replaceWith(span); });
    return template.innerHTML;
  }, [draft?.content, draft?.loaded, preview?.content, revision]);
  useEffect(() => {
    const host = root.current; if (!host) return;
    let anchor: HTMLElement | undefined, enterTimer: ReturnType<typeof setTimeout> | undefined, exitTimer: ReturnType<typeof setTimeout> | undefined, request = 0;
    let originalTitle: string | null = null;
    const restoreTitle = () => { if (anchor && originalTitle !== null) anchor.setAttribute("title", originalTitle); originalTitle = null; };
    const cancelExit = () => { clearTimeout(exitTimer); };
    const clear = () => {
      request++; clearTimeout(enterTimer); clearTimeout(exitTimer);
      if (anchor?.getAttribute("aria-describedby") === id) anchor.removeAttribute("aria-describedby");
      restoreTitle(); anchor = undefined; setPreview(undefined);
    };
    const exit = () => { clearTimeout(enterTimer); cancelExit(); exitTimer = setTimeout(clear, 180); };
    keep.current = cancelExit; leave.current = exit;
    const show = (element: HTMLElement) => {
      const target = noteLinkTarget(element, sourcePath); if (!target) { clear(); return; }
      if (anchor === element) { cancelExit(); return; }
      clear(); anchor = element; originalTitle = element.getAttribute("title"); element.removeAttribute("title");
      enterTimer = setTimeout(async () => {
        if (!element.isConnected) { clear(); return; }
        const currentRequest = ++request;
        const reference = useKnowledgeStore.getState().resolveLink(sourcePath, target);
        const rect = element.getBoundingClientRect();
        const width = Math.min(360, window.innerWidth - 24), above = window.innerHeight - rect.bottom < 320 && rect.top > window.innerHeight / 2;
        const position = { left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? rect.top - 8 : Math.max(12, rect.bottom + 8), above, maxHeight: Math.max(60, Math.min(320, above ? rect.top - 20 : window.innerHeight - rect.bottom - 20)) };
        const path = reference.resolvedPath;
        const base = { ...position, title: withoutMarkdownExtension(basename(path ?? target)), path };
        element.setAttribute("aria-describedby", id);
        if (!path) { setPreview({ ...base, message: reference.status === "ambiguous" ? "Più note con questo nome. Clicca sul link per scegliere." : "Questa nota non esiste ancora." }); return; }
        if (isConfiguratorPath(path)) {
          setPreview({ ...base, title: configTitle(basename(path)), loading: true });
          try {
            const data=useConfiguratorStore.getState().sessions[path]?.data ?? parseConfigurator((await vaultService.readText(path)).content);
            if(request===currentRequest) setPreview({ ...base,title:data.title,message:`Configuratore · ${data.parameters.length} parametri · ${data.components.length} componenti · ${data.rules.length} regole. Clicca per aprire.` });
          } catch { if(request===currentRequest) setPreview({...base,message:"Configuratore non disponibile."}); }
          return;
        }
        const session = useDocumentStore.getState().sessions[path];
        if (session?.loaded) { setPreview({ ...base, content: session.content }); return; }
        setPreview({ ...base, loading: true });
        try {
          const file = await vaultService.readText(path);
          if (request === currentRequest) setPreview({ ...base, content: file.content });
        } catch { if (request === currentRequest) setPreview({ ...base, message: "Anteprima non disponibile. Apri la nota per riprovare." }); }
      }, 350);
    };
    const over = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === "touch") return;
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>(noteLinkSelector) : null;
      if (element && host.contains(element)) show(element);
    };
    const out = (event: Event) => {
      const related = (event as PointerEvent).relatedTarget as Node | null;
      if (related && (anchor?.contains(related) || card.current?.contains(related))) return;
      exit();
    };
    const scroll = (event: Event) => { if (!card.current?.contains(event.target as Node)) clear(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && anchor) { event.stopPropagation(); clear(); } };
    const pointer = (event: PointerEvent) => { if (!card.current?.contains(event.target as Node)) clear(); };
    host.addEventListener("pointerover", over); host.addEventListener("pointerout", out);
    host.addEventListener("focusin", over); host.addEventListener("focusout", out);
    window.addEventListener("scroll", scroll, true); window.addEventListener("resize", clear);
    window.addEventListener("keydown", key, true); window.addEventListener("pointerdown", pointer);
    return () => {
      request++; clearTimeout(enterTimer); clearTimeout(exitTimer);
      if (anchor?.getAttribute("aria-describedby") === id) anchor.removeAttribute("aria-describedby");
      restoreTitle();
      host.removeEventListener("pointerover", over); host.removeEventListener("pointerout", out);
      host.removeEventListener("focusin", over); host.removeEventListener("focusout", out);
      window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", clear);
      window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", pointer);
    };
  }, [sourcePath, root, id]);
  if (!preview) return null;
  return createPortal(<div ref={card} id={id} className="note-link-preview" role="tooltip" style={{ left: preview.left, top: preview.top, maxHeight: preview.maxHeight, transform: preview.above ? "translateY(-100%)" : undefined }} onPointerEnter={() => keep.current()} onPointerLeave={() => leave.current()}>
    <header><FileText size={16} /><div><strong>{preview.title}</strong>{preview.path && <small>{withoutMarkdownExtension(preview.path)}</small>}</div></header>
    {preview.loading && <p className="note-preview-message"><LoaderCircle size={16} className="spin" />Apertura anteprima…</p>}
    {preview.message && <p className="note-preview-message">{preview.message}</p>}
    {!preview.loading && !preview.message && (html.trim() ? <div className="note-preview-content" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="note-preview-message">Nota vuota</p>)}
  </div>, document.body);
}

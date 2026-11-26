import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { vaultService } from "../vault/vaultService";
import { navigationKnowledge } from "../configurator/navigationKnowledge";
import highlightStyles from "../../styles/highlight-colors.css?inline";
import quoteBlockStyles from "../../styles/quote-blocks.css?inline";
import { applyImageWidth } from "../../domain/imageWidth";

export const pdfStyles = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; } html { color-scheme: light; }
body { margin: 0; color: #20242c; background: white; font: 11pt/1.55 system-ui, sans-serif; overflow-wrap: anywhere; }
h1,h2,h3,h4,h5,h6 { line-height: 1.25; break-after: avoid; margin: 1em 0 .5em; }
@media print {
  @supports (box-decoration-break: clone) {
    /* Keep the bottom inset in the document instead of the browser's URL margin. */
    @page { margin-bottom: 0; }
    .pdf-content { padding-bottom: 18mm; box-decoration-break: clone; }
  }
  hr { display: none; }
  /* Require preceding content and use one break for consecutive separators. */
  .pdf-content > :not(hr) ~ h2,
  .pdf-content > :not(hr) ~ hr + :not(hr) { break-before: page; }
  .pdf-content > h1 + h2 { break-before: auto; }
}
p,li { orphans: 3; widows: 3; } img { max-width: 100%; height: auto; max-height: 245mm; object-fit: contain; break-inside: avoid; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f3f5; padding: 10pt; border: 1px solid #ddd; }
code { font-family: ui-monospace, monospace; font-size: .9em; } blockquote { margin: 12pt 0; border-left: 3px solid #8b5cf6; padding: 6pt 12pt; background: #f6f4fb; }
a { color: #49398d; text-decoration: underline; } table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 9pt; margin: 12pt 0; }
th,td { padding: 6pt; border: 1px solid #828d9e; vertical-align: top; overflow-wrap: anywhere; } th { background: #f0f1f4; } thead:not([hidden]) { display: table-header-group; } tr { break-inside: avoid; }
input[type=checkbox] { accent-color: #5d478f; } .image-error { color: #a32e2e; } video,audio { display: none; }
body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
${highlightStyles}
${quoteBlockStyles}
`;

export function pagePdfContent(content: string): HTMLElement {
  const article=document.createElement("article");
  const body=document.createElement("div");body.className="pdf-content";body.innerHTML=renderMarkdownSafe(content,navigationKnowledge());
  for(const table of body.querySelectorAll<HTMLTableElement>("table")) {
    table.style.width="100%";
    const cols=[...table.querySelectorAll<HTMLTableColElement>("col")];
    const sum=cols.reduce((n,c)=>n+(parseFloat(c.style.width)||0),0);
    if(sum)for(const col of cols)col.style.width=`${(parseFloat(col.style.width)||0)/sum*100}%`;
  }
  for(const img of body.querySelectorAll<HTMLImageElement>("img"))img.loading="eager";
  for(const control of body.querySelectorAll<HTMLInputElement>("input"))control.disabled=true;
  article.append(body);return article;
}

/** Uses the local browser PDF printer: no upload, rasterization or editor mutation. */
export async function exportPagePdf(content: string, sourcePath: string): Promise<number> {
  const frame=document.createElement("iframe");frame.title="Esportazione pagina PDF";frame.setAttribute("aria-hidden","true");
  frame.style.cssText="position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.append(frame);
  const urls:string[]=[];let warnings=0;
  let expiry:ReturnType<typeof setTimeout> | undefined;
  const cleanup=()=>{clearTimeout(expiry);frame.remove();urls.forEach(url=>URL.revokeObjectURL(url));};
  try {
    const doc=frame.contentDocument, win=frame.contentWindow;
    if(!doc || !win)throw new Error("Impossibile aprire l’esportazione PDF.");
    doc.documentElement.lang="it";
    const style=doc.createElement("style");style.textContent=pdfStyles;doc.head.append(style);
    const article=pagePdfContent(content);doc.body.append(doc.adoptNode(article));
    await Promise.all([...article.querySelectorAll<HTMLElement>("[data-nebula-image]")].map(async placeholder=>{
      try {
        const blob=await vaultService.readImage(resolveImagePath(sourcePath,placeholder.dataset.nebulaImage!));
        const url=URL.createObjectURL(blob);urls.push(url);
        const img=doc.createElement("img");img.alt=placeholder.getAttribute("aria-label") ?? "";applyImageWidth(img, placeholder.dataset.nebulaImageWidth);img.src=url;placeholder.replaceWith(img);
      }catch {warnings++;placeholder.textContent=`Immagine non disponibile: ${placeholder.dataset.nebulaImage}`;placeholder.className="image-error";}
    }));
    await Promise.all([...article.querySelectorAll<HTMLImageElement>("img")].map(img=>new Promise<void>(resolve=>{
      let timer:ReturnType<typeof setTimeout>;
      const finish=(failed=false)=>{clearTimeout(timer);img.onload=null;img.onerror=null;if(failed){warnings++;const label=doc.createElement("span");label.className="image-error";label.textContent=`Immagine non disponibile: ${img.alt || "immagine"}`;img.replaceWith(label);}resolve();};
      timer=setTimeout(()=>finish(true),10000);
      if(img.complete){finish(img.naturalWidth===0);return;}
      img.onload=()=>finish();img.onerror=()=>finish(true);
    })));
    await doc.fonts?.ready;
    const finish=()=>cleanup();
    win.addEventListener("afterprint",finish,{once:true});
    // Retain image URLs while the system dialog is open, including Safari's asynchronous printer.
    expiry=setTimeout(finish,300000);
    win.focus();win.print();
    return warnings;
  }catch(error){cleanup();throw error;}
}

import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { vaultService } from "../vault/vaultService";
import { navigationKnowledge } from "../configurator/navigationKnowledge";

export const pdfStyles = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; } html { color-scheme: light; }
body { margin: 0; color: #20242c; background: white; font: 11pt/1.55 system-ui, sans-serif; overflow-wrap: anywhere; }
h1,h2,h3,h4,h5,h6 { line-height: 1.25; break-after: avoid; margin: 1em 0 .5em; }
.page-title { font-size: 24pt; margin-top: 0; padding-bottom: 10pt; border-bottom: 1px solid #ccd0d8; }
p,li { orphans: 3; widows: 3; } img { max-width: 100%; height: auto; max-height: 245mm; object-fit: contain; break-inside: avoid; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f3f5; padding: 10pt; border: 1px solid #ddd; }
code { font-family: ui-monospace, monospace; font-size: .9em; } blockquote { margin: 12pt 0; border-left: 3px solid #8b5cf6; padding: 6pt 12pt; background: #f6f4fb; }
a { color: #49398d; text-decoration: underline; } table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 9pt; margin: 12pt 0; }
th,td { padding: 6pt; border: 1px solid #bbb; vertical-align: top; overflow-wrap: anywhere; } th { background: #f0f1f4; } thead { display: table-header-group; } tr { break-inside: avoid; }
input[type=checkbox] { accent-color: #5d478f; } .image-error { color: #a32e2e; } video,audio { display: none; }
body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

export function pagePdfContent(content: string, title: string): HTMLElement {
  const article=document.createElement("article");
  const heading=document.createElement("h1");heading.className="page-title";heading.textContent=title;
  const body=document.createElement("div");body.innerHTML=renderMarkdownSafe(content,navigationKnowledge());
  for(const table of body.querySelectorAll<HTMLTableElement>("table")) {
    table.style.width="100%";
    const cols=[...table.querySelectorAll<HTMLTableColElement>("col")];
    const sum=cols.reduce((n,c)=>n+(parseFloat(c.style.width)||0),0);
    if(sum)for(const col of cols)col.style.width=`${(parseFloat(col.style.width)||0)/sum*100}%`;
  }
  for(const img of body.querySelectorAll<HTMLImageElement>("img"))img.loading="eager";
  for(const control of body.querySelectorAll<HTMLInputElement>("input"))control.disabled=true;
  article.append(heading,body);return article;
}

/** Uses the local browser PDF printer: no upload, rasterization or editor mutation. */
export async function exportPagePdf(content: string, title: string, sourcePath: string): Promise<number> {
  const frame=document.createElement("iframe");frame.title="Esportazione pagina PDF";frame.setAttribute("aria-hidden","true");
  frame.style.cssText="position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.append(frame);
  const urls:string[]=[];let warnings=0;
  const originalTitle=document.title;
  let expiry:ReturnType<typeof setTimeout> | undefined;
  const cleanup=()=>{clearTimeout(expiry);document.title=originalTitle;frame.remove();urls.forEach(url=>URL.revokeObjectURL(url));};
  try {
    const doc=frame.contentDocument, win=frame.contentWindow;
    if(!doc || !win)throw new Error("Impossibile aprire l’esportazione PDF.");
    doc.title=title;doc.documentElement.lang="it";
    const style=doc.createElement("style");style.textContent=pdfStyles;doc.head.append(style);
    const article=pagePdfContent(content,title);doc.body.append(doc.adoptNode(article));
    await Promise.all([...article.querySelectorAll<HTMLElement>("[data-nebula-image]")].map(async placeholder=>{
      try {
        const blob=await vaultService.readImage(resolveImagePath(sourcePath,placeholder.dataset.nebulaImage!));
        const url=URL.createObjectURL(blob);urls.push(url);
        const img=doc.createElement("img");img.alt=placeholder.getAttribute("aria-label") ?? "";img.src=url;placeholder.replaceWith(img);
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
    document.title=title;
    const finish=()=>cleanup();
    win.addEventListener("afterprint",finish,{once:true});
    // Retain image URLs while the system dialog is open, including Safari's asynchronous printer.
    expiry=setTimeout(finish,300000);
    win.focus();win.print();document.title=originalTitle;
    return warnings;
  }catch(error){cleanup();throw error;}
}

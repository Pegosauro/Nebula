import { afterEach, describe, expect, it, vi } from "vitest";
import { exportPagePdf, pagePdfContent, pdfStyles } from "./exportPagePdf";
import { serializeTable } from "./markdownTools";

afterEach(()=>{document.querySelectorAll('iframe[title="Esportazione pagina PDF"]').forEach(f=>f.remove());vi.restoreAllMocks();});
describe("local page PDF export",()=>{
  it("renders the latest Markdown without frontmatter/internal markers or scripts and preserves merged tables",()=>{
    const table=serializeTable([["A","B"],["Uno","Due"]],[],{widths:[200,600],spans:[{row:1,column:0,rows:1,columns:2}]});
    const content=`---\ntags: [private]\n---\n# Titolo\n\n**Ultima modifica**\n\n${table}\n\n<script>alert(1)</script>\n<!-- nebula-quick-note:abc -->`;
    const article=pagePdfContent(content,"Pagina <sicura>");
    expect(article.querySelector(".page-title")?.textContent).toBe("Pagina <sicura>");
    expect(article.querySelector("strong")?.textContent).toBe("Ultima modifica");
    expect(article.querySelector("script")).toBeNull();expect(article.textContent).not.toContain("private");
    expect(article.querySelector('td[colspan="2"]')).not.toBeNull();
    expect(article.querySelector("table")?.style.width).toBe("100%");
    expect([...article.querySelectorAll("col")].map(c=>c.style.width)).toEqual(["25%","75%"]);
    expect(article.textContent).not.toContain("nebula-quick-note");
    expect(pdfStyles).toContain("size: A4");
  });
  it("opens the system printer on an isolated document and cleans up after cancellation/printing",async()=>{
    const original=document.title;
    const promise=exportPagePdf("# Testo\n\nContenuto corrente","Prova PDF","Prova.md");
    const frame=document.querySelector<HTMLIFrameElement>('iframe[title="Esportazione pagina PDF"]')!;
    const win=frame.contentWindow!;
    const print=vi.spyOn(win,"print").mockImplementation(()=>{});vi.spyOn(win,"focus").mockImplementation(()=>{});
    expect(await promise).toBe(0);expect(print).toHaveBeenCalledOnce();
    expect(frame.contentDocument!.body.textContent).toContain("Contenuto corrente");
    expect(frame.contentDocument!.title).toBe("Prova PDF");expect(document.title).toBe(original);
    win.dispatchEvent(new Event("afterprint"));expect(frame.isConnected).toBe(false);
  });
});

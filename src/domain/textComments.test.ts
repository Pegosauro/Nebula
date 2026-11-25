import { describe, expect, it } from "vitest";
import { anchorTextComment, joinTextComments, splitTextComments } from "./textComments";

const id = "1147ce8f-aef9-4d19-ac6b-d2e19c5de2d9";
const commentFor = (body: string, quote: string) => {
  const from = body.indexOf(quote);
  return { id, text: "Verifica il simbolo →\n<!-- esempio -->", ...anchorTextComment(body, from, from + quote.length) };
};

describe("Markdown text comments", () => {
  it("round-trips Markdown bytes and encodes comment terminators including with CRLF", () => {
    const body = "# Nota\r\n\r\nTesto con caffè.\r\n";
    const comment = commentFor(body.replaceAll("\r\n", "\n"), "caffè");
    const source = joinTextComments(body, [comment]);
    expect(source.match(/-->/gu)).toHaveLength(1);
    expect(splitTextComments(source)).toEqual({ body, comments: [comment] });
    expect(joinTextComments(body, [])).toBe(body);
    expect(splitTextComments("Nota\n\n<!-- nebula-text-comments:v1 %ZZ -->\n").comments).toEqual([]);
  });

  it("uses context to distinguish repeated text after a change outside Nebula", () => {
    const first = "Primo controllo: 5 mm di gioco nella distinta.";
    const second = "Seconda misura: 5 mm di gioco nel disegno.";
    const original = `${first}\n\n${second}`;
    const comment = commentFor(original, "5 mm di gioco");
    const edited = `${second}\n\nNuova riga.\n\n${first}`;
    expect(splitTextComments(joinTextComments(edited, [comment])).comments[0]?.from).toBe(edited.lastIndexOf(comment.quote));
  });

  it("keeps a detached comment after deletion or when a remaining quote lacks its context", () => {
    const original = "Confermare prima del taglio.";
    const comment = commentFor(original, "del taglio");
    for (const body of ["Controllare la misura.", "Marcatura del taglio laser."]) {
      expect(splitTextComments(joinTextComments(body, [comment])).comments[0]).toEqual({ ...comment, from: null });
    }
  });
});

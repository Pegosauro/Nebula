import { expect, it } from "vitest";
import { codeLanguage, codeTokens, fencedPayload, formatExcelDisplay, indentVba } from "./codeBlock";

it("reads every fenced line without interpreting shorter fences, tabs or trailing spaces", () => {
  expect(fencedPayload("~~~~text\n\tuno  \n~~~\n\n~~~~  \n")).toBe("\tuno  \n~~~\n");
  expect(fencedPayload("```\n\tuno\n\n")).toBe("\tuno\n\n");
});

it("detects only supported automatic modes and respects explicit text", () => {
  expect(codeLanguage("", "' commento\nPrivate Sub Aggiorna()\nEnd Sub")).toBe("vba");
  expect(codeLanguage("", '=SE(A1="";"";A1)')).toBe("excel");
  expect(codeLanguage("", "Una formula = A1")).toBe("text");
  expect(codeLanguage("text", "=A1")).toBe("text");
});

it("indents structured VBA and keeps unsupported compound statements intact", () => {
  const source = ["Sub Aggiorna()", "Select Case x", "Case 1", "If pronto Then", 'Testo = "A:B"', "Else", "' commento", "End If", "Case Else", "Exit Sub", "End Select", "End Sub"].join("\n");
  const expected = ["Sub Aggiorna()", "    Select Case x", "        Case 1", "            If pronto Then", '                Testo = "A:B"', "            Else", "                ' commento", "            End If", "        Case Else", "            Exit Sub", "    End Select", "End Sub"].join("\n");
  expect(indentVba(source)).toBe(expected);
  expect(indentVba(expected)).toBe(expected);
  const uncertain = "Sub Demo()\nIf pronto Then: Exit Sub\nEnd Sub";
  expect(indentVba(uncertain)).toBe(uncertain);
});

it("adds Excel display whitespace outside strings, sheet names, arrays and structured references", () => {
  const formula = '=SE(A1="a;""b";\'Magazzino;Nord\'!B2;SOMMA(Tabella1[[a];[b]];1,5;{1;2}))';
  const formatted = '=SE(\n    A1="a;""b";\n    \'Magazzino;Nord\'!B2;\n    SOMMA(\n        Tabella1[[a];[b]];\n        1,5;\n        {1;2}\n    )\n)';
  expect(formatExcelDisplay(formula)).toBe(formatted);
  expect(codeTokens("=LOG10(A1)", "excel").map(token => token.style)).toEqual(["keyword", "reference"]);
});

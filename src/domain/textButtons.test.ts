import { expect, test } from "vitest";
import { parseTextButtons, serializeTextButton, withoutTextButtons, type TextButtonConfig } from "./textButtons";

const config: TextButtonConfig = { label: "Controllo", position: "after", text: "### Controllo del {{data}}\n\n- [ ] Verificare il profilo\n<!-- esempio -->" };

test("round-trips the button configuration without introducing raw Markdown delimiters", () => {
  const marker = serializeTextButton(config);
  const note = `A\n\n${marker}\n\nB`;
  expect(parseTextButtons(note)).toEqual([{ from: 3, to: 3 + marker.length, raw: marker, config }]);
  expect(withoutTextButtons(note)).toBe("A\n\n\n\nB");
  expect(marker.match(/-->/gu)).toHaveLength(1);
});

test("leaves fenced examples, quoted markers and malformed payloads inert", () => {
  const marker = serializeTextButton(config);
  const fenced = ["```md", marker, "```"].join("\n");
  const examples = ["---", "marker: |", "  " + marker, "---", "", fenced, "", "> " + marker, "", "<!-- nebula-text-button:v1 %ZZ -->"];
  expect(parseTextButtons(examples.join("\n"))).toEqual([]);
});

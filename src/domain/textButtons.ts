import { markdownLanguage } from "@codemirror/lang-markdown";
import { maskFrontmatter } from "./noteProperties";

export interface TextButtonConfig {
  label: string;
  position: "before" | "after";
  text: string;
}

export interface TextButtonBlock {
  from: number;
  to: number;
  raw: string;
  config: TextButtonConfig;
}

const prefix = "<!-- nebula-text-button:v1 ";
const suffix = " -->";
export const textButtonLimits = { label: 80, text: 16000 };

export function validTextButton(value: unknown): value is TextButtonConfig {
  if (typeof value !== "object" || value === null) return false;
  const { label, position, text } = value as Partial<TextButtonConfig>;
  return typeof label === "string" && !!label.trim() && label.length <= textButtonLimits.label && !/[\r\n]/u.test(label)
    && (position === "before" || position === "after")
    && typeof text === "string" && !!text.trim() && text.length <= textButtonLimits.text;
}

export function serializeTextButton(config: TextButtonConfig): string {
  const payload = JSON.stringify({ label: config.label.trim(), position: config.position, text: config.text });
  return prefix + encodeURIComponent(payload).replaceAll("-", "%2D") + suffix;
}

export function parseTextButtons(source: string): TextButtonBlock[] {
  if (!source.includes(prefix)) return [];
  const blocks: TextButtonBlock[] = [];
  markdownLanguage.parser.parse(maskFrontmatter(source)).iterate({
    enter(node) {
      if (node.name === "Document") return;
      if (node.name === "CommentBlock") {
        const raw = source.slice(node.from, node.to);
        const boundary = source[node.to];
        if ((node.from === 0 || source[node.from - 1] === "\n")
          && (boundary === undefined || boundary === "\r" || boundary === "\n")
          && raw.startsWith(prefix) && raw.endsWith(suffix) && !/[\r\n]/u.test(raw)) {
          try {
            const config: unknown = JSON.parse(decodeURIComponent(raw.slice(prefix.length, -suffix.length)));
            if (validTextButton(config)) blocks.push({ raw, config, from: node.from, to: node.to });
          } catch { /* Invalid metadata remains an ordinary Markdown comment. */ }
        }
      }
      // Only standalone top-level comments are actionable.
      return false;
    },
  });
  return blocks;
}

export function withoutTextButtons(source: string): string {
  const blocks = parseTextButtons(source);
  let end = 0;
  const parts: string[] = [];
  for (const block of blocks) {
    parts.push(source.slice(end, block.from));
    end = block.to;
  }
  return blocks.length ? parts.join("") + source.slice(end) : source;
}

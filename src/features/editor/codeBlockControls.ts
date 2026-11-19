import { codeLabel, codeLanguage, codeMode, codeModes, codeTokens, excelBreaks, formatExcelDisplay, type CodeMode } from "../../domain/codeBlock";

const iconPaths = {
  copy: "M8 8h11v12H8zM16 8V4H4v12h4",
  check: "m5 12 4 4L19 6",
  indent: "M4 5h16M9 10h11M9 15h11M4 20h16",
} as const;

function icon(owner: Document, name: keyof typeof iconPaths) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = owner.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = owner.createElementNS(ns, "path");
  path.setAttribute("d", iconPaths[name]);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function button(parent: HTMLElement, text: string, run: () => void) {
  const control = parent.ownerDocument.createElement("button");
  control.type = "button";
  control.textContent = text;
  control.addEventListener("click", run);
  parent.append(control);
  return control;
}

interface CodeControls {
  info: string;
  source: string;
  expanded?: boolean;
  setMode?: (mode: CodeMode) => void;
  format?: () => void;
  toggle?: () => void;
  compact?: { active: boolean; toggle: () => void };
}

export function canCompactCode(display: string): boolean {
  let newline = -1;
  for (let line = 0; line < 10; line++) {
    newline = display.indexOf("\n", newline + 1);
    if (newline === -1) return false;
  }
  return true;
}

function updateCompactButton(control: HTMLButtonElement, compact: boolean) {
  control.textContent = compact ? "Espandi codice" : "Compatta a 10 righe";
  control.setAttribute("aria-expanded", String(!compact));
}

export function setCodeCompact(pre: HTMLPreElement, compact: boolean) {
  pre.classList.toggle("is-code-compact", compact);
  if (compact) {
    pre.tabIndex = 0;
    pre.setAttribute("role", "region");
    pre.setAttribute("aria-label", "Codice scorrevole");
  } else {
    pre.removeAttribute("tabindex");
    pre.removeAttribute("role");
    pre.removeAttribute("aria-label");
  }
}

export function codeBlockControls(owner: Document, options: CodeControls) {
  const { info, source, expanded, setMode, format, toggle, compact } = options;
  const mode = codeMode(info), language = codeLanguage(info, source);
  const bar = owner.createElement("span");
  bar.className = "nebula-code-toolbar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Strumenti blocco di codice");
  if (setMode) {
    const select = owner.createElement("select");
    select.setAttribute("aria-label", "Linguaggio del blocco");
    for (const [value, label] of codeModes) {
      const option = owner.createElement("option");
      option.value = value;
      option.textContent = value || language === "text" ? label : `${label} · ${codeLabel("", language)}`;
      select.append(option);
    }
    if (!codeModes.some(([value]) => value === mode)) {
      const current = owner.createElement("option");
      current.value = mode;
      current.textContent = mode;
      select.append(current);
    }
    select.value = mode;
    select.addEventListener("change", () => setMode(select.value as CodeMode));
    bar.append(select);
  } else {
    const label = owner.createElement("span");
    label.className = "nebula-code-label";
    label.textContent = codeLabel(mode, language);
    bar.append(label);
  }

  const actions = owner.createElement("span");
  actions.className = "nebula-code-actions";
  bar.append(actions);
  if (format) {
    const control = button(actions, "Formatta", format);
    control.title = "Sistema i rientri VBA";
    control.prepend(icon(owner, "indent"));
  }
  if (toggle) {
    const layout = button(actions, expanded ? "Compatta formula" : "Su più righe", toggle);
    layout.className = "nebula-code-layout";
    layout.setAttribute("aria-label", "Formula su più righe");
    layout.setAttribute("aria-pressed", String(!!expanded));
    layout.title = expanded ? "Mostra formula compatta" : "Mostra formula su più righe";
  }
  if (compact) {
    const control = button(actions, "", compact.toggle);
    control.className = "nebula-code-compact";
    updateCompactButton(control, compact.active);
  }
  const status = owner.createElement("span");
  status.className = "nebula-code-status";
  status.setAttribute("role", "status");
  let reset: ReturnType<typeof setTimeout> | undefined;
  const copy = button(actions, "Copia", () => {
    void (async () => {
      try {
        await owner.defaultView!.navigator.clipboard.writeText(source);
        clearTimeout(reset);
        copy.replaceChildren(icon(owner, "check"), "Copiato");
        copy.dataset.copied = "true";
        status.textContent = "Blocco di codice copiato";
        reset = setTimeout(() => {
          copy.replaceChildren(icon(owner, "copy"), "Copia");
          delete copy.dataset.copied;
          status.textContent = "";
        }, 2000);
      } catch {
        status.textContent = "Copia non riuscita";
        copy.textContent = "Riprova";
      }
    })();
  });
  copy.className = "nebula-code-copy";
  copy.prepend(icon(owner, "copy"));
  copy.setAttribute("aria-label", "Copia blocco di codice");
  actions.append(status);
  return bar;
}

export function drawCode(code: HTMLElement, display: string, language: ReturnType<typeof codeLanguage>) {
  const owner = code.ownerDocument;
  const nodes = owner.createDocumentFragment();
  let at = 0;
  for (const token of codeTokens(display, language)) {
    if (token.from > at) nodes.append(owner.createTextNode(display.slice(at, token.from)));
    const span = owner.createElement("span");
    span.className = `nebula-code-${token.style}`;
    span.textContent = display.slice(token.from, token.to);
    nodes.append(span);
    at = token.to;
  }
  nodes.append(owner.createTextNode(display.slice(at)));
  code.replaceChildren(nodes);
}

export function attachCodePreview(pre: HTMLPreElement) {
  if (pre.parentElement?.classList.contains("nebula-code-block")) return;
  const code = pre.querySelector("code");
  if (!code) return;
  const owner = pre.ownerDocument;
  const { info, source } = JSON.parse(pre.dataset.nebulaCode!) as { info: string; source: string };
  const language = codeLanguage(info, source);
  const breaks = language === "excel" ? excelBreaks(source) : [];
  const canExpand = breaks.length > 0;
  let expanded = canExpand && source.length > 80;
  let compact = false;
  const hasLongSource = canCompactCode(source);
  const canCompact = () => hasLongSource || (expanded && breaks.length >= 10);
  const wrap = owner.createElement("div");
  wrap.className = "nebula-code-block";
  function updateDisplay() {
    drawCode(code!, expanded ? formatExcelDisplay(source) : source, language);
    const control = bar.querySelector<HTMLButtonElement>(".nebula-code-compact");
    if (control) {
      control.hidden = !canCompact();
      updateCompactButton(control, compact);
    }
    setCodeCompact(pre, compact);
  }
  const bar = codeBlockControls(owner, { info, source, expanded, toggle: canExpand ? () => {
    expanded = !expanded;
    if (!canCompact()) compact = false;
    updateDisplay();
    const toggle = bar.querySelector<HTMLButtonElement>(".nebula-code-layout")!;
    toggle.textContent = expanded ? "Compatta formula" : "Su più righe";
    toggle.title = expanded ? "Mostra formula compatta" : "Mostra formula su più righe";
    toggle.setAttribute("aria-pressed", String(expanded));
  } : undefined, compact: hasLongSource || breaks.length >= 10 ? { active: compact, toggle: () => {
    compact = !compact;
    setCodeCompact(pre, compact);
    updateCompactButton(bar.querySelector<HTMLButtonElement>(".nebula-code-compact")!, compact);
  } } : undefined });
  pre.replaceWith(wrap);
  wrap.append(bar, pre);
  updateDisplay();
  return bar;
}

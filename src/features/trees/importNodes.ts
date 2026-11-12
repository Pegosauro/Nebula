import { CATEGORY_PALETTE, MAX_DEPTH, MAX_NODES, codeStep, conformSuffix, depthOf, joinCode, normCode, uid, type Tree, type TreeCategory } from "./model";

interface ClipboardRow { cells: string[]; row: number }
export interface ImportRow { row: number; name: string; category: string; note: string; code: string; categoryId: string | null; errors: string[] }
export interface ImportOptions { header: boolean; createCategories: boolean }
export interface ImportPlan { rows: ImportRow[]; errors: string[]; newCategories: string[]; tree?: Tree }
const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("it-IT");

/** Formato copiato da Excel: tabulazioni, celle quotate, virgolette doppie e note su più righe. */
function clipboardRows(text: string): { rows: ClipboardRow[]; error?: string } {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: ClipboardRow[] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false, row = 1;
  const finishCell = () => { cells.push(cell); cell = ""; closed = false; };
  const finishRow = () => { finishCell(); rows.push({ cells, row }); cells = []; row += 1; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === "\t") finishCell();
    else if (char === "\n") finishRow();
    else if (char === '"' && cell === "" && !closed) quoted = true;
    else if (closed) {
      if (char !== " ") return { rows, error: `Riga ${row}: caratteri inattesi dopo una cella tra virgolette.` };
    } else cell += char;
  }
  if (quoted) return { rows, error: `Riga ${row}: virgolette non chiuse. Incolla di nuovo le celle da Excel.` };
  if (cell.length || cells.length) finishRow();
  return { rows };
}
export function hasImportHeader(text: string): boolean {
  const first = clipboardRows(text).rows[0]?.cells;
  return Boolean(first && normalize(first[0] ?? "") === "nome" && first.length <= 3
    && (first.length < 2 || normalize(first[1] ?? "") === "categoria")
    && (first.length < 3 || normalize(first[2] ?? "") === "note"));
}

/** Prepara tutti i nodi in una sola operazione; con errori non restituisce alcuna modifica. */
export function planNodeImport(tree: Tree, parentId: string, text: string, options: ImportOptions): ImportPlan {
  const parsed = clipboardRows(text);
  const errors: string[] = parsed.error ? [parsed.error] : [];
  const records = (options.header ? parsed.rows.slice(1) : parsed.rows).filter(row => row.cells.some(cell => cell.trim()));
  const parent = tree.nodes.find(node => node.id === parentId);
  if (!records.length) errors.push("Incolla almeno una riga con un nome.");
  if (!parent) errors.push("Scegli un nodo padre valido.");
  else if (depthOf(tree, parentId) + 1 > MAX_DEPTH) errors.push(`Profondità massima di ${MAX_DEPTH} livelli raggiunta.`);
  if (tree.nodes.length + records.length > MAX_NODES) errors.push(`L'importazione supera il limite di ${MAX_NODES} nodi della struttura.`);
  const categories: TreeCategory[] = [...tree.categories];
  const categoryIndex = new Map<string, TreeCategory[]>();
  for (const category of categories) {
    const key = normalize(category.name);
    categoryIndex.set(key, [...(categoryIndex.get(key) ?? []), category]);
  }
  const newCategories: string[] = [];
  const rows: ImportRow[] = records.map(record => {
    const name = (record.cells[0] ?? "").trim();
    const category = (record.cells[1] ?? "").trim();
    const note = record.cells[2] ?? "";
    const issues: string[] = [];
    if (!name) issues.push("Il nome è obbligatorio.");
    if (record.cells.length > 3) issues.push("Usa solo le colonne Nome, Categoria e Note. Il codice è automatico.");
    let categoryId: string | null = null;
    if (category) {
      const key = normalize(category);
      const matches = categoryIndex.get(key) ?? [];
      if (matches.length > 1) issues.push(`Categoria ambigua: «${category}». Rinomina le categorie omonime prima di importare.`);
      else if (matches[0]) categoryId = matches[0].id;
      else if (!options.createCategories) issues.push(`Categoria non trovata: «${category}». Puoi abilitare la creazione delle categorie mancanti.`);
      else {
        const used = new Set(categories.map(item => item.color));
        const color = CATEGORY_PALETTE.find(item => !used.has(item.color))?.color ?? CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length]!.color;
        const created: TreeCategory = { id: uid(), name: category, color, order: categories.reduce((max, item) => Math.max(max, item.order), -1) + 1 };
        categories.push(created); categoryIndex.set(key, [created]); newCategories.push(category); categoryId = created.id;
      }
    }
    return { row: record.row, name, category, note, categoryId, code: "", errors: issues };
  });
  if (parent) {
    const width = codeStep(tree);
    const usedCodes = new Set(tree.nodes.map(node => normCode(node.code)));
    const siblings = tree.nodes.filter(node => node.parentId === parentId);
    const usedSuffixes = new Set(siblings.flatMap(node => {
      const suffix = conformSuffix(tree, node.code, parent.code);
      return suffix ? [suffix] : [];
    }));
    let cursor = 1;
    const limit = 10 ** width;
    for (const row of rows) {
      while (cursor < limit) {
        const suffix = String(cursor++).padStart(width, "0");
        const code = joinCode(tree, parent.code, suffix);
        if (usedSuffixes.has(suffix) || usedCodes.has(normCode(code))) continue;
        row.code = code; usedCodes.add(normCode(code)); break;
      }
      if (!row.code) row.errors.push(`Nessun codice libero sotto ${parent.code}.`);
    }
  }
  if (errors.length || rows.some(row => row.errors.length)) return { rows, errors, newCategories };
  const next = structuredClone(tree);
  next.categories = structuredClone(categories);
  const order = tree.nodes.filter(node => node.parentId === parentId).reduce((max, node) => Math.max(max, node.order), -1) + 1;
  next.nodes.push(...rows.map((row, index) => ({ id: uid(), parentId, order: order + index, code: row.code, name: row.name, categoryMode: "own" as const, categoryId: row.categoryId, note: row.note, objects: [] })));
  return { rows, errors, newCategories, tree: next };
}

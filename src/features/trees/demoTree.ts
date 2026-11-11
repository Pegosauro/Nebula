import type { CharacteristicKind, Tree, TreeObject } from "./model";

/** Dati dimostrativi della tenda finestra, con gli stessi id del prototipo. */
export function demoTree(): Tree {
  const categories = [
    ["c-cfg", "Configurazione", "#8b5cf6"],
    ["c-dim", "Dimensioni", "#22d3ee"],
    ["c-avv", "Avvisi", "#e0a33a"],
    ["c-tes", "Telo e tessuti", "#2aa99a"],
    ["c-col", "Colori e finiture", "#ec6fb0"],
    ["c-ins", "Installazione", "#5b8def"],
    ["c-mot", "Motorizzazione", "#f2784b"],
  ] as const;
  const tree: Tree = {
    format: "nebula-tree",
    version: 1,
    title: "FL · Tenda finestra",
    rootId: "n-root",
    categories: categories.map(([id, name, color], order) => ({ id, name, color, order })),
    nodes: [],
  };
  const siblingOrder = new Map<string, number>();
  const add = (id: string, parentId: string | null, code: string, name: string, categoryId?: string | null, extra: { note?: string; objects?: TreeObject[] } = {}) => {
    const key = parentId ?? "";
    const order = siblingOrder.get(key) ?? 0;
    siblingOrder.set(key, order + 1);
    tree.nodes.push({
      id,
      parentId,
      order: parentId == null ? 0 : order,
      code,
      name,
      categoryMode: parentId == null || categoryId ? "own" : "inherit",
      categoryId: categoryId ?? null,
      note: extra.note ?? "",
      objects: extra.objects ?? [],
    });
  };
  const table = (id: string, tableName: string, order: number): TreeObject => ({ id, type: "externalTable", order, tableName });
  const characteristic = (id: string, kind: CharacteristicKind, code: string, description: string, order: number): TreeObject => ({ id, type: "characteristic", order, kind, code, description });
  add("n-root", null, "FL", "Tenda finestra", "c-cfg", { note: "Struttura dimostrativa ricavata dallo screenshot del gestionale legacy." });
  add("n-01", "n-root", "FL-01", "Tipologia di configurazione");
  add("n-03", "n-root", "FL-03", "Riferimento listino");
  add("n-44", "n-root", "FL-44", "Riferimento installazione", "c-ins");
  add("n-04", "n-root", "FL-04", "Modello");
  add("n-47", "n-root", "FL-47", "ATTENZIONE! Tessuto in esaurimento", "c-avv", { note: "Avviso mostrato in fase d'ordine." });
  add("n-59", "n-root", "FL-59", ">>>> Tipologia T-LOOP");
  add("n-07", "n-root", "FL-07", "Larghezza tenda", "c-dim");
  add("n-0701", "n-07", "FL-0701", "Limite larghezza");
  add("n-0702", "n-07", "FL-0702", "Larghezza");
  add("n-08", "n-root", "FL-08", "Altezza tenda", "c-dim");
  add("n-0801", "n-08", "FL-0801", "Limite altezza da tabella");
  add("n-0804", "n-08", "FL-0804", "H max * interni (da tabella)", undefined, { objects: [table("o-1", "TE_LIMITI_CHIUSURE", 0)] });
  add("n-0802", "n-08", "FL-0802", "H max per superficie max * interni");
  add("n-0803", "n-08", "FL-0803", "Altezza", "c-dim", {
    note: "Altezza utile in mm, da sotto cassonetto.",
    objects: [
      characteristic("o-2", "own", "P", "PROFONDITA'", 0),
      characteristic("o-3", "own", "H", "Altezza utile", 1),
      characteristic("o-4", "acquired", "HT", "Altezza tenda", 2),
    ],
  });
  add("n-09", "n-root", "FL-09", "Dimensioni tenda", "c-dim");
  ["Larghezza finita", "Altezza finita", "Sormonto", "Fuori luce", "Luce netta", "Tolleranza"].forEach((name, index) => {
    add(`n-090${index + 1}`, "n-09", `FL-090${index + 1}`, name);
  });
  add("n-10", "n-root", "FL-10", "Tipologia confezionamento telo", "c-tes");
  add("n-1001", "n-10", "FL-1001", "Telo singolo");
  add("n-1002", "n-10", "FL-1002", "Telo doppio");
  add("n-x1", "n-10", "X-1", "Nota libera di confezione", undefined, { note: "Codice libero: non segue il prefisso del padre." });
  add("n-x1a", "n-x1", "X-101", "Dettaglio nota");
  add("n-12", "n-root", "FL-12", "Accessori", "c-mot");
  add("n-19", "n-root", "FL-19", "Colore struttura", "c-col");
  add("n-1901", "n-19", "FL-1901", "RAL standard");
  add("n-fake", "n-19", "FL-0907", "Colore speciale (codice storico)", undefined, { note: "Codice storico fuori prefisso: provoca un conflitto se sposti un nodo conforme dentro FL-09." });
  add("n-57", "n-root", "FL-57", "Guida laterale");
  add("n-58", "n-root", "FL-58", "Alimentazione motore", "c-mot");
  add("n-5801", "n-58", "FL-5801", "Motore radio");
  add("n-71", "n-root", "FL-71", "Note di produzione");
  return tree;
}

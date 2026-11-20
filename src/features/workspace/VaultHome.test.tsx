import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "../../domain/vault";
import * as notes from "../notes/quickNotes";
import { newTask, type Task } from "../tasks/taskModel";
import { taskSession } from "../tasks/taskSession";
import { useVaultStore } from "../vault/vaultStore";
import { vaultService } from "../vault/vaultService";
import { HomeQuickNote } from "./HomeQuickNote";
import { tasksForHome, HomeToday } from "./HomeToday";
import { HomeRecent } from "./HomeRecent";
import { selectHomeDocuments, useHomeHistory } from "./homeDocuments";
import { useWorkspaceStore } from "./workspaceStore";

let root: Root | undefined;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  useHomeHistory.setState({ documents: {} });
  useWorkspaceStore.getState().resetDocuments();
  useWorkspaceStore.getState().setActivity("files");
  useVaultStore.setState({ status: "idle", snapshot: undefined, activeVaultId: undefined });
  localStorage.clear();
  vi.restoreAllMocks();
});

async function render(child: ReactNode) {
  if (!root) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root!.render(child));
}

async function write(text: string) {
  const field = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return field;
}

async function click(selector: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click());
}

function entry(path: string): VaultEntry {
  return { path, id: path, name: path.split("/").at(-1)!, extension: ".md", type: "file" };
}

describe("Inizio", () => {
  it("retains an appunto across navigation, retries with the same identity and accepts Ctrl+Invio", async () => {
    const save = vi.spyOn(notes, "saveQuickNote").mockRejectedValueOnce(new Error("Disco non scrivibile")).mockResolvedValue(undefined);
    await render(<HomeQuickNote vaultId="appunti" />);
    await write("Verifica collaudo");
    await render(null);
    await render(<HomeQuickNote vaultId="appunti" />);
    const field = host.querySelector("textarea")!;
    expect(field.value).toBe("Verifica collaudo");
    field.focus();
    const submit = async () => act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true })));
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Disco non scrivibile");
    expect(field.value).toBe("Verifica collaudo");
    await submit();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[2]).toBe(save.mock.calls[1]?.[2]);
    expect(field.value).toBe("");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Appunto salvato");
    expect(document.activeElement).toBe(field);
  });

  it("retains the in-flight save and its result if Inizio is revisited immediately", async () => {
    let finish!: () => void;
    const save = vi.spyOn(notes, "saveQuickNote").mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(<HomeQuickNote vaultId="appunto-in-corso" />);
    await write("Da salvare una volta");
    await click("[type=submit]");
    await render(null);
    await render(<HomeQuickNote vaultId="appunto-in-corso" />);
    const field = host.querySelector("textarea")!;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe("Da salvare una volta");
    await act(async () => finish());
    expect(field.value).toBe("");
    expect(field.readOnly).toBe(false);
    expect(save).toHaveBeenCalledOnce();
  });

  it("shows up to four overdue, due today or pinned tasks and omits completed items", () => {
    const today = "2026-11-20";
    const tasks = [
      newTask("Importante", null, null, true),
      newTask("Oggi", null, today, false),
      newTask("Fra settimane", null, "2026-12-01", false),
      newTask("Prima scadenza", null, "2026-11-15", false),
      newTask("Scaduta", null, "2026-11-19", true),
      newTask("Oggi anche", null, today, false),
      { ...newTask("Già finita", null, "2026-11-13", true), done: true },
    ];
    expect(tasksForHome(tasks, today).map(task => task.title)).toEqual(["Prima scadenza", "Scaduta", "Oggi", "Oggi anche"]);
    expect(tasksForHome(tasks.slice(0, 3), today).map(task => task.title)).toEqual(["Oggi", "Importante"]);
  });

  it("shares the task state, persists completion and undo, and opens the task detail", async () => {
    const task = newTask("Verificare imballi", "team", null, true);
    let disk = JSON.stringify({ version: 1, groups: [], tasks: [task] });
    const save = vi.fn(async (content: string) => { disk = content; });
    vi.spyOn(vaultService, "taskFile").mockReturnValue({ read: async () => disk, write: save });
    await render(<HomeToday vaultId="task-home" />);
    const selector = '[role=checkbox][aria-label="Completa Verificare imballi"]';
    expect(host.querySelector(selector)).not.toBeNull();
    await click(selector);
    expect(JSON.parse(disk).tasks[0].done).toBe(true);
    expect(host.querySelector(selector)?.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector(".home-task-feedback")?.textContent).toBe("Task completataAnnulla");
    await click(".home-task-feedback button");
    expect(JSON.parse(disk).tasks[0].done).toBe(false);
    expect(host.querySelector(selector)?.getAttribute("aria-checked")).toBe("false");
    expect(save).toHaveBeenCalledTimes(2);
    const session = taskSession("task-home");
    session.layout.setState({ filter: "overdue", group: "another", collapsed: ["team"] });
    await click(".home-entry-title");
    expect(useWorkspaceStore.getState().activity).toBe("tasks");
    expect(session.layout.getState()).toMatchObject({ selectedId: task.id, filter: "all", group: "", collapsed: [] });
  });

  it("keeps the task visible and reports the error if completion cannot be saved", async () => {
    const task = newTask("Misure", null, null, true);
    vi.spyOn(vaultService, "taskFile").mockReturnValue({
      read: async () => JSON.stringify({ version: 1, groups: [], tasks: [task] }),
      write: vi.fn().mockRejectedValue(new Error("Disco non scrivibile")),
    });
    await render(<HomeToday vaultId="task-home-error" />);
    await click("[role=checkbox]");
    expect(taskSession("task-home-error").store.getState().board?.tasks[0]?.done).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Disco non scrivibile");
    expect(host.querySelector(".home-task-feedback")).toBeNull();
  });

  it("stores recent documents and pins per Vault, including renames, and reopens the selected entry", async () => {
    const history = useHomeHistory.getState();
    const names = ["A", "B", "C", "D", "E", "F"].map(name => `${name}.md`);
    names.forEach(path => history.recordOpen("lavoro", path));
    history.recordOpen("personale", "Privato.md");
    const active = () => selectHomeDocuments(useHomeHistory.getState(), "lavoro");
    await render(<HomeRecent vaultId="lavoro" root={names.map(entry)} />);
    expect(host.querySelectorAll(".home-open-document")).toHaveLength(5);
    await click('[aria-label="Fissa F"]');
    await click('[aria-label="Fissa E"]');
    await click('[aria-label="Fissa D"]');
    await click('[aria-label="Fissa C"]');
    expect(host.querySelector(".home-pin-message")?.textContent).toContain("3");
    expect(active().pinned).toEqual(["F.md", "E.md", "D.md"]);
    expect(selectHomeDocuments(useHomeHistory.getState(), "personale").recent.map(item => item.path)).toEqual(["Privato.md"]);
    await act(async () => history.remap("lavoro:backup", "F.md", "Modulo.md"));
    expect(active().pinned).toEqual(["Modulo.md", "E.md", "D.md"]);
    await render(null);
    useHomeHistory.setState({ documents: {} });
    await render(<HomeRecent vaultId="lavoro" root={["Modulo.md", ...names.slice(0, -1)].map(entry)} />);
    const reopen = vi.spyOn(useWorkspaceStore.getState(), "openEntry").mockImplementation(() => {});
    await click('[title="Modulo.md"]');
    expect(reopen).toHaveBeenCalledWith(entry("Modulo.md"));
  });
});

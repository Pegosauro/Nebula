import { expect, it } from "vitest";
import { TaskFileConflict } from "./taskFile";
import { newTask, readTaskBoard } from "./taskModel";
import { createTaskSession } from "./taskSession";

it("serializes edits during a pending save and writes the latest board", async () => {
  let disk: string | null = null;
  let release!: () => void;
  const firstWrite = new Promise<void>(resolve => { release = resolve; });
  const session = createTaskSession({
    read: async () => disk,
    write: async (content, expected) => {
      expect(expected).toBe(disk);
      if (disk === null) await firstWrite;
      disk = content;
    },
  });
  await session.load();
  session.change(board => ({ ...board, tasks: [newTask("Nuova task", null, null, false)] }));
  session.change(board => ({ ...board, tasks: board.tasks.map(task => ({ ...task, pinned: true })) }));
  release();
  await session.save();
  expect(readTaskBoard(disk!).tasks[0]).toMatchObject({ title: "Nuova task", pinned: true });
  expect(session.store.getState().status).toBe("ready");
});

it("keeps the unsaved draft if another tab changed the board", async () => {
  const session = createTaskSession({
    read: async () => null,
    write: async () => { throw new TaskFileConflict(); },
  });
  await session.load();
  session.change(board => ({ ...board, tasks: [newTask("Bozza", null, null, false)] }));
  await session.save();
  expect(session.store.getState()).toMatchObject({ status: "conflict", board: { tasks: [{ title: "Bozza" }] } });
});

import { describe, expect, it } from "vitest";
import { emptyBoard, localDay, matchesFilter, moveTask, newTask, readTaskBoard, remapTaskNotes, taskQuadrant } from "./taskModel";

const today = "2026-11-18";
const tomorrow = "2026-11-19";

describe("task priorities", () => {
  it("classifies yesterday, today and tomorrow as urgent, and honors overrides", () => {
    const task = newTask("Controlla distinta", null, today, true);
    for (const due of ["2026-11-17", today, tomorrow]) expect(taskQuadrant({ ...task, due }, tomorrow)).toBe("do");
    for (const due of ["2026-11-20", null]) expect(taskQuadrant({ ...task, due }, tomorrow)).toBe("plan");
    expect(taskQuadrant({ ...task, urgency: "not-urgent" }, tomorrow)).toBe("plan");
    expect(taskQuadrant({ ...task, urgency: "urgent", pinned: false, due: null }, tomorrow)).toBe("quick");
  });

  it("preserves the deadline and keeps automatic urgency on a vertical move", () => {
    const task = newTask("Controlla distinta", null, today, false);
    const important = moveTask(task, "do", tomorrow);
    expect(important).toMatchObject({ due: today, pinned: true, urgency: "auto" });
    const planned = moveTask(important, "later", tomorrow);
    expect(planned).toMatchObject({ due: today, pinned: false, urgency: "not-urgent" });
    expect(moveTask(planned, "later", tomorrow)).toBe(planned);
  });

  it("uses local calendar days across month boundaries and excludes completed tasks from active filters", () => {
    expect(localDay(new Date(2026, 11, 31, 23, 59), 1)).toBe("2027-01-01");
    const task = newTask("Controlla distinta", null, "2026-11-17", true);
    expect(matchesFilter(task, "overdue", today)).toBe(true);
    expect(matchesFilter(task, "today", today)).toBe(false);
    expect(matchesFilter({ ...task, done: true }, "important", today)).toBe(false);
    expect(matchesFilter({ ...task, done: true }, "all", today)).toBe(true);
  });

  it("keeps links through folder moves without changing similarly named folders", () => {
    const task = { ...newTask("Controlla distinta", null, null, false), notes: ["A/Note.md", "AB/Note.md", "B/Note.md"] };
    const board = { ...emptyBoard, tasks: [task] };
    expect(remapTaskNotes(board, "X", "Y")).toBe(board);
    expect(remapTaskNotes(board, "A", "B").tasks[0].notes).toEqual(["B/Note.md", "AB/Note.md"]);
    expect(readTaskBoard(JSON.stringify(board))).toEqual(board);
    expect(() => readTaskBoard('{"version":2,"groups":[],"tasks":[]}')).toThrow();
  });
});

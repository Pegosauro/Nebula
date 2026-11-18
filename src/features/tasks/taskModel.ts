import { isPathInside } from "../../domain/path";

export type Urgency = "auto" | "urgent" | "not-urgent";
export type Quadrant = "do" | "plan" | "quick" | "later";
export type TaskFilter = "all" | "today" | "overdue" | "important";
export const groupColors = {
  slate: { name: "Ardesia", hex: "#78849c" },
  violet: { name: "Viola", hex: "#8b5ed4" },
  blue: { name: "Blu", hex: "#4285d4" },
  teal: { name: "Turchese", hex: "#248c86" },
  green: { name: "Verde", hex: "#579450" },
  yellow: { name: "Giallo", hex: "#bd8d21" },
  orange: { name: "Arancione", hex: "#ce723e" },
  red: { name: "Rosso", hex: "#c45557" },
  pink: { name: "Rosa", hex: "#bd6096" },
} as const;
export type GroupColor = keyof typeof groupColors;
export interface TaskGroup { id: string; name: string; color?: GroupColor }

export function taskGroupColor(color?: GroupColor) {
  return color && Object.hasOwn(groupColors, color) ? groupColors[color].hex : groupColors.slate.hex;
}
export interface Subtask { id: string; title: string; done: boolean }
export interface TaskComment { id: string; text: string; createdAt: string }
export interface Task {
  id: string;
  title: string;
  done: boolean;
  pinned: boolean;
  groupId: string | null;
  due: string | null;
  urgency: Urgency;
  subtasks: Subtask[];
  notes: string[];
  comments: TaskComment[];
}
export interface TaskBoard { version: 1; groups: TaskGroup[]; tasks: Task[] }

export const emptyBoard: TaskBoard = { version: 1, groups: [], tasks: [] };

export function newTask(title: string, groupId: string | null, due: string | null, pinned: boolean, note?: string): Task {
  return { id: crypto.randomUUID(), title, groupId, due, pinned, done: false, urgency: "auto", subtasks: [], notes: note ? [note] : [], comments: [] };
}

export function localDay(date = new Date(), offset = 0): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-");
}

export function taskQuadrant(task: Task, tomorrow: string): Quadrant {
  const urgent = task.urgency === "auto" ? !!task.due && task.due <= tomorrow : task.urgency === "urgent";
  if (task.pinned) return urgent ? "do" : "plan";
  return urgent ? "quick" : "later";
}

export function moveTask(task: Task, target: Quadrant, tomorrow: string): Task {
  const current = taskQuadrant(task, tomorrow);
  if (current === target) return task;
  const isUrgent = (quadrant: Quadrant) => quadrant === "do" || quadrant === "quick";
  const urgency = isUrgent(current) === isUrgent(target) ? task.urgency : isUrgent(target) ? "urgent" : "not-urgent";
  return { ...task, pinned: target === "do" || target === "plan", urgency };
}

export function matchesFilter(task: Task, filter: TaskFilter, today: string) {
  if (filter === "important") return task.pinned && !task.done;
  if (filter === "today") return task.due === today && !task.done;
  if (filter === "overdue") return !!task.due && task.due < today && !task.done;
  return true;
}

export function orderTasks(a: Task, b: Task) {
  return Number(a.done) - Number(b.done) || Number(b.pinned) - Number(a.pinned)
    || (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99");
}

export function remapTaskNotes(board: TaskBoard, oldPath: string, newPath: string): TaskBoard {
  if (!board.tasks.some(task => task.notes.some(path => isPathInside(path, oldPath)))) return board;
  return { ...board, tasks: board.tasks.map(task => ({
    ...task, notes: [...new Set(task.notes.map(path => isPathInside(path, oldPath) ? newPath + path.slice(oldPath.length) : path))],
  })) };
}

export function readTaskBoard(content: string): TaskBoard {
  const board = JSON.parse(content) as TaskBoard | null;
  const hasTitle = (value: Subtask) => !!value && typeof value.id === "string" && typeof value.title === "string" && typeof value.done === "boolean";
  if (board?.version !== 1
    || !Array.isArray(board.groups) || !board.groups.every(group => group && typeof group.id === "string" && typeof group.name === "string")
    || !Array.isArray(board.tasks) || !board.tasks.every(task => hasTitle(task) && typeof task.pinned === "boolean"
      && (task.groupId === null || typeof task.groupId === "string")
      && (task.due === null || (typeof task.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due)))
      && ["auto", "urgent", "not-urgent"].includes(task.urgency)
      && Array.isArray(task.notes) && task.notes.every(path => typeof path === "string")
      && Array.isArray(task.subtasks) && task.subtasks.every(hasTitle)
      && Array.isArray(task.comments) && task.comments.every(comment => comment && typeof comment.id === "string" && typeof comment.text === "string" && typeof comment.createdAt === "string"))) {
    throw new Error("Il file delle task ha un formato non riconosciuto.");
  }
  return board;
}

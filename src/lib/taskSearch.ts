import type { Task } from "../types";

export function filterTasksBySearch(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    if (t.title.toLowerCase().includes(q)) return true;
    if (t.notes.toLowerCase().includes(q)) return true;
    return t.steps.some((s) => s.title.toLowerCase().includes(q));
  });
}

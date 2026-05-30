import { addDays, addMonths, addWeeks } from "date-fns";
import type { Recurrence, Task } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

/** 截止日结束时刻（仅日期，当日 23:59） */
export function taskDueMs(task: Task): number | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  if (task.dueTime) {
    const parts = task.dueTime.split(":").map((x) => Number(x));
    const hh = parts[0] ?? 23;
    const mm = parts[1] ?? 59;
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }
  return new Date(y, m - 1, d, 23, 59, 0, 0).getTime();
}

export function toReminderIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function parseReminderMs(iso: string): number | null {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** 重复任务完成时，将提醒时刻推进到下一周期（保持时分） */
export function advanceReminderInstant(
  reminderAt: string,
  recurrence: Recurrence,
): string {
  const base = new Date(reminderAt);
  let next = base;
  switch (recurrence) {
    case "daily":
      next = addDays(base, 1);
      break;
    case "weekly":
      next = addWeeks(base, 1);
      break;
    case "monthly":
      next = addMonths(base, 1);
      break;
    default:
      next = addDays(base, 1);
  }
  return next.toISOString();
}

export function formatReminderLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const ymd = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dayLabel =
    ymd(d) === ymd(today)
      ? "今天"
      : ymd(d) === ymd(new Date(today.getTime() + 86_400_000))
        ? "明天"
        : `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${dayLabel} ${time}`;
}

export function reminderInOneHour(): string {
  return toReminderIso(Date.now() + 3_600_000);
}

export function reminderTonight20(): string {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return toReminderIso(d.getTime());
}

export function reminderTomorrowMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toReminderIso(d.getTime());
}

export type TaskReminderEvent = {
  task: Task;
  fireAt: string;
  fireMs: number;
};

export function findDueTaskReminders(
  tasks: Task[],
  nowMs: number = Date.now(),
): TaskReminderEvent[] {
  const out: TaskReminderEvent[] = [];
  for (const task of tasks) {
    if (task.completed || !task.reminderAt) continue;
    const fireMs = parseReminderMs(task.reminderAt);
    if (fireMs === null || fireMs > nowMs) continue;
    if (task.reminderLastFiredAt === task.reminderAt) continue;
    out.push({ task, fireAt: task.reminderAt, fireMs });
  }
  out.sort((a, b) => a.fireMs - b.fireMs);
  return out;
}

export function patchAfterTaskReminderFire(task: Task): Partial<Task> {
  return {
    reminderLastFiredAt: task.reminderAt,
    updatedAt: nowIso(),
  };
}

export function clearReminderFireIfChanged(
  task: Task,
  patch: Partial<Task>,
): Partial<Task> {
  if (!Object.prototype.hasOwnProperty.call(patch, "reminderAt")) return patch;
  const next = patch.reminderAt !== undefined ? patch.reminderAt : task.reminderAt;
  if (next === task.reminderAt) return patch;
  return { ...patch, reminderLastFiredAt: null };
}

import type { ReminderPolicy, Task } from "../types";
import { taskDueMs, toReminderIso, parseReminderMs } from "./taskReminder";

function nowIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_REMINDER_POLICY: ReminderPolicy = {
  daysBeforeFirst: 3,
  daysBeforeSecond: 1,
  finalHoursBeforeDue: 24,
  finalIntervalHours: 2,
};

export function normalizeReminderPolicy(
  raw: Partial<ReminderPolicy> | undefined | null,
): ReminderPolicy {
  const d = DEFAULT_REMINDER_POLICY;
  const n = (v: unknown, fallback: number, min: number, max: number) => {
    const x = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.min(max, Math.max(min, x));
  };
  return {
    daysBeforeFirst: n(raw?.daysBeforeFirst, d.daysBeforeFirst, 0, 30),
    daysBeforeSecond: n(raw?.daysBeforeSecond, d.daysBeforeSecond, 0, 30),
    finalHoursBeforeDue: n(raw?.finalHoursBeforeDue, d.finalHoursBeforeDue, 1, 168),
    finalIntervalHours: n(raw?.finalIntervalHours, d.finalIntervalHours, 1, 12),
  };
}

export function dueSoonSlotsForTask(
  task: Task,
  policy: ReminderPolicy,
): string[] {
  if (task.completed || !task.dueDate) return [];
  const dueMs = taskDueMs(task);
  if (dueMs === null) return [];

  const msSet = new Set<number>();
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;

  if (policy.daysBeforeFirst > 0) {
    msSet.add(dueMs - policy.daysBeforeFirst * dayMs);
  }
  if (policy.daysBeforeSecond > 0) {
    msSet.add(dueMs - policy.daysBeforeSecond * dayMs);
  }

  const windowStart = dueMs - policy.finalHoursBeforeDue * hourMs;
  const step = policy.finalIntervalHours * hourMs;
  for (let t = windowStart; t < dueMs; t += step) {
    msSet.add(t);
  }
  msSet.add(dueMs);

  return [...msSet]
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)
    .map(toReminderIso);
}

export function isDueSoonSlotNotified(task: Task, fireAt: string): boolean {
  return (task.dueSoonNotifiedSlots ?? []).includes(fireAt);
}

export type DueSoonNotifyEvent = {
  task: Task;
  fireAt: string;
  fireMs: number;
};

export function findDueSoonNotifications(
  tasks: Task[],
  policy: ReminderPolicy,
  nowMs: number = Date.now(),
): DueSoonNotifyEvent[] {
  const out: DueSoonNotifyEvent[] = [];
  for (const task of tasks) {
    if (task.completed || !task.dueDate) continue;
    for (const fireAt of dueSoonSlotsForTask(task, policy)) {
      const fireMs = parseReminderMs(fireAt);
      if (fireMs === null || fireMs > nowMs) continue;
      if (isDueSoonSlotNotified(task, fireAt)) continue;
      out.push({ task, fireAt, fireMs });
    }
  }
  out.sort((a, b) => a.fireMs - b.fireMs);
  return out;
}

export function patchAfterDueSoonNotify(
  task: Task,
  fireAt: string,
): Partial<Task> {
  const fired = [...(task.dueSoonNotifiedSlots ?? [])];
  if (!fired.includes(fireAt)) fired.push(fireAt);
  return {
    dueSoonNotifiedSlots: fired,
    updatedAt: nowIso(),
  };
}

export function clearDueSoonSlotsIfDueChanged(
  task: Task,
  patch: Partial<Task>,
): Partial<Task> {
  if (!Object.prototype.hasOwnProperty.call(patch, "dueDate")) return patch;
  const dueDate = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
  if (dueDate === task.dueDate) return patch;
  return { ...patch, dueSoonNotifiedSlots: [] };
}

export function formatDueSoonTitle(task: Task, fireAt: string): string {
  const dueMs = taskDueMs(task);
  const fireMs = parseReminderMs(fireAt);
  if (dueMs === null || fireMs === null) return `临期：${task.title}`;
  const hoursLeft = Math.max(0, Math.round((dueMs - fireMs) / 3_600_000));
  if (hoursLeft === 0) return `即将到期：${task.title}`;
  if (hoursLeft >= 24) {
    const days = Math.round(hoursLeft / 24);
    return `${days}天后：${task.title}`;
  }
  return `${hoursLeft}小时后：${task.title}`;
}

export function dueSoonNotifyBody(
  task: Task,
  fireAt: string,
  policy: ReminderPolicy,
): string {
  const dueMs = taskDueMs(task);
  const fireMs = parseReminderMs(fireAt);
  if (dueMs === null || fireMs === null) return "";
  const due = new Date(dueMs);
  const dueStr = `${due.getMonth() + 1}/${due.getDate()} ${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
  const hoursLeft = Math.max(0, Math.round((dueMs - fireMs) / 3_600_000));
  if (hoursLeft >= policy.daysBeforeFirst * 24 - 12) {
    return `截止 ${dueStr} · 提前 ${policy.daysBeforeFirst} 天`;
  }
  if (hoursLeft >= policy.daysBeforeSecond * 24 - 12) {
    return `截止 ${dueStr} · 提前 ${policy.daysBeforeSecond} 天`;
  }
  if (hoursLeft <= policy.finalIntervalHours + 1) {
    return `截止 ${dueStr} · 即将到期`;
  }
  return `截止 ${dueStr} · 剩余约 ${hoursLeft} 小时`;
}

export function migrateTaskDueSoonFields(task: Task): Task {
  const legacy = task.reminderFiredSlots ?? [];
  const slots =
    task.dueSoonNotifiedSlots && task.dueSoonNotifiedSlots.length > 0
      ? task.dueSoonNotifiedSlots
      : legacy;
  const { reminderFiredSlots: _legacy, ...rest } = task;
  return {
    ...rest,
    dueSoonNotifiedSlots: slots,
  };
}

import type { Task } from "../types";
import { advanceDueDate } from "./dates";
import { newId } from "./id";
import { advanceReminderInstant } from "./taskReminder";

function nowIso(): string {
  return new Date().toISOString();
}

/** 对标微软 To Do：勾选完成时生成下一周期实例，保留提醒时刻（按周期推进） */
export function buildRecurringCloneOnComplete(task: Task): Task {
  const nextDue = task.dueDate
    ? advanceDueDate(task.dueDate, task.recurrence)
    : null;
  return {
    ...task,
    id: newId(),
    completed: false,
    dueDate: nextDue,
    reminderAt: task.reminderAt
      ? advanceReminderInstant(task.reminderAt, task.recurrence)
      : null,
    reminderLastFiredAt: null,
    dueSoonNotifiedSlots: [],
    myDayDate: null,
    steps: task.steps.map((st) => ({
      ...st,
      id: newId(),
      completed: false,
    })),
    attachments: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

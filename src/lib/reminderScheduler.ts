import type { List, ReminderPolicy, Task } from "../types";
import {
  findDueSoonNotifications,
  dueSoonNotifyBody,
  type DueSoonNotifyEvent,
} from "./dueSoonNotify";
import { findDueTaskReminders, type TaskReminderEvent } from "./taskReminder";

function listNameForTask(task: Task, lists: List[]): string {
  return lists.find((l) => l.id === task.listId)?.name ?? "";
}

export type DueSoonNotification = {
  task: Task;
  listName: string;
  fireAt: string;
  body: string;
};

export type TaskReminderNotification = {
  task: Task;
  listName: string;
  fireAt: string;
};

/** 已到点的全局临期通知 */
export function findDueSoonToNotify(
  tasks: Task[],
  lists: List[],
  policy: ReminderPolicy,
  nowMs: number = Date.now(),
): DueSoonNotification[] {
  const events = findDueSoonNotifications(tasks, policy, nowMs);
  return events.map(({ task, fireAt }) => ({
    task,
    fireAt,
    listName: listNameForTask(task, lists),
    body: dueSoonNotifyBody(task, fireAt, policy),
  }));
}

/** 已到点的任务提醒（用户于详情中设置） */
export function findTaskRemindersDue(
  tasks: Task[],
  lists: List[],
  nowMs: number = Date.now(),
): TaskReminderNotification[] {
  const events = findDueTaskReminders(tasks, nowMs);
  return events.map(({ task, fireAt }) => ({
    task,
    fireAt,
    listName: listNameForTask(task, lists),
  }));
}

/** @deprecated */
export function findDueReminders(
  tasks: Task[],
  lists: List[],
  policy: ReminderPolicy,
  nowMs?: number,
): DueSoonNotification[] {
  return findDueSoonToNotify(tasks, lists, policy, nowMs);
}

export type { DueSoonNotifyEvent, TaskReminderEvent };

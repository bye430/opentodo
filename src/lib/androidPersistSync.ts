import type { AppStateV1, Task } from "../types";
import { migrateTaskDueSoonFields, normalizeReminderPolicy } from "./dueSoonNotify";
import { isAndroid } from "./platform";
import { rolloverIfNeeded } from "./persistRollover";
import { todayYmd } from "./dates";
import { normalizeSidebarMotto } from "./sidebarMotto";

type PersistEnvelope = {
  state?: Partial<AppStateV1>;
  version?: number;
};

function normalizeTasksFromDisk(tasks: Task[]): Task[] {
  return tasks.map(migrateTaskDueSoonFields);
}

/** 原生闹钟已写盘时，从磁盘合并任务，避免内存覆盖 reminderLastFiredAt */
export async function syncAppStateFromAndroidDisk(
  merge: (partial: Partial<AppStateV1>) => void,
): Promise<boolean> {
  if (!isAndroid()) return false;
  const read = window.todoData?.read;
  if (!read) return false;
  const text = await read();
  if (!text) return false;
  let envelope: PersistEnvelope;
  try {
    envelope = JSON.parse(text) as PersistEnvelope;
  } catch {
    return false;
  }
  const state = envelope.state ?? (envelope as unknown as AppStateV1);
  if (!state?.tasks) return false;
  const policy = normalizeReminderPolicy(state.reminderPolicy);
  const rolled = rolloverIfNeeded({
    version: 1,
    theme: state.theme ?? "system",
    hideCompleted: state.hideCompleted ?? false,
    sidebarMotto: normalizeSidebarMotto(state.sidebarMotto),
    reminderPolicy: policy,
    lastCalendarDate: state.lastCalendarDate ?? todayYmd(),
    listGroups: state.listGroups ?? [],
    lists: state.lists ?? [],
    tasks: normalizeTasksFromDisk(state.tasks),
  });
  merge({
    tasks: rolled.tasks,
    lastCalendarDate: rolled.lastCalendarDate,
    listGroups: rolled.listGroups,
    lists: rolled.lists,
    theme: rolled.theme,
    hideCompleted: rolled.hideCompleted,
    sidebarMotto: rolled.sidebarMotto,
    reminderPolicy: rolled.reminderPolicy,
  });
  return true;
}

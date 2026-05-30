import type { AppStateV1 } from "../types";
import { migrateTaskDueSoonFields } from "./dueSoonNotify";
import { todayYmd } from "./dates";

function nowIso(): string {
  return new Date().toISOString();
}

export function rolloverIfNeeded(state: AppStateV1): AppStateV1 {
  const today = todayYmd();
  let tasks = state.tasks.map(migrateTaskDueSoonFields);
  let changed = tasks.some((t, i) => t !== state.tasks[i]);
  if (state.lastCalendarDate !== today) {
    tasks = tasks.map((t) => {
      if (t.myDayDate && t.myDayDate < today && !t.completed) {
        changed = true;
        return { ...t, myDayDate: null, updatedAt: nowIso() };
      }
      return t;
    });
  }
  if (state.lastCalendarDate === today && !changed) {
    return state;
  }
  return {
    ...state,
    tasks,
    lastCalendarDate: today,
  };
}

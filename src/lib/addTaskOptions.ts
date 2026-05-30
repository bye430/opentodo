import type { Recurrence } from "../types";

export type AddTaskDraftOptions = {
  dueDate?: string | null;
  recurrence?: Recurrence;
  reminderAt?: string | null;
};

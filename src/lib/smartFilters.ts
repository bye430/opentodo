import type { SmartView, Task } from "../types";
import { isDueOverdue, isDueToday, isDueTomorrow, todayYmd } from "./dates";

function hasDue(t: Task): boolean {
  return Boolean(t.dueDate);
}

export function filterTasksForView(
  tasks: Task[],
  view: SmartView,
  opts: { hideCompleted: boolean },
): Task[] {
  let list = [...tasks];
  if (opts.hideCompleted) {
    list = list.filter((t) => !t.completed);
  }

  switch (view.kind) {
    case "my-day": {
      const d = todayYmd();
      return list.filter((t) => t.myDayDate === d);
    }
    case "important":
      return list.filter((t) => t.starred);
    case "planned": {
      const withDue = list.filter((t) => hasDue(t));
      switch (view.bucket) {
        case "all":
          return withDue;
        case "overdue":
          return withDue.filter((t) => isDueOverdue(t.dueDate));
        case "today":
          return withDue.filter((t) => isDueToday(t.dueDate));
        case "tomorrow":
          return withDue.filter((t) => isDueTomorrow(t.dueDate));
        case "later":
          return withDue.filter(
            (t) =>
              !isDueOverdue(t.dueDate) &&
              !isDueToday(t.dueDate) &&
              !isDueTomorrow(t.dueDate),
          );
        default:
          return withDue;
      }
    }
    case "all":
      return list;
    case "list":
      return list.filter((t) => t.listId === view.listId);
    default:
      return list;
  }
}

export function sortTasksByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const d = a.sortOrder - b.sortOrder;
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

export type PlannedBucket = "overdue" | "today" | "tomorrow" | "later";

const PLANNED_SECTIONS: { bucket: PlannedBucket; label: string }[] = [
  { bucket: "overdue", label: "已逾期" },
  { bucket: "today", label: "今天" },
  { bucket: "tomorrow", label: "明天" },
  { bucket: "later", label: "以后" },
];

/** 计划内智能列表：按分桶分组（bucket=all 时用） */
export function groupPlannedTasks(tasks: Task[]): { bucket: PlannedBucket; label: string; tasks: Task[] }[] {
  const list = tasks.filter((t) => hasDue(t) && !t.completed);
  return PLANNED_SECTIONS.map(({ bucket, label }) => {
    let section: Task[];
    switch (bucket) {
      case "overdue":
        section = list.filter((t) => isDueOverdue(t.dueDate));
        break;
      case "today":
        section = list.filter((t) => isDueToday(t.dueDate));
        break;
      case "tomorrow":
        section = list.filter((t) => isDueTomorrow(t.dueDate));
        break;
      case "later":
        section = list.filter(
          (t) =>
            !isDueOverdue(t.dueDate) &&
            !isDueToday(t.dueDate) &&
            !isDueTomorrow(t.dueDate),
        );
        break;
    }
    return { bucket, label, tasks: sortTasksByOrder(section) };
  }).filter((s) => s.tasks.length > 0);
}

/** My Day 建议排序：逾期感、星标、截止日期、更新时间 */
export function sortMyDaySuggestions(tasks: Task[]): Task[] {
  const score = (t: Task): number => {
    let s = 0;
    if (t.dueDate && isDueOverdue(t.dueDate)) s += 100;
    if (t.starred) s += 40;
    if (t.dueDate) s += 10;
    s += Math.min(5, t.steps.filter((x) => !x.completed).length);
    return s;
  };
  return [...tasks].sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

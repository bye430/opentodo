import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
} from "date-fns";

export function ymdFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function todayYmd(): string {
  return ymdFromDate(new Date());
}

export function tomorrowYmd(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export function nextWeekYmd(): string {
  return format(addWeeks(new Date(), 1), "yyyy-MM-dd");
}

export function parseYmd(s: string): Date {
  return startOfDay(parseISO(s));
}

export function isDueOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = parseYmd(dueDate);
  const t = startOfDay(new Date());
  return isBefore(d, t);
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return isEqual(parseYmd(dueDate), startOfDay(new Date()));
}

export function isDueTomorrow(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return isEqual(parseYmd(dueDate), startOfDay(addDays(new Date(), 1)));
}

export function advanceDueDate(
  dueDate: string,
  recurrence: import("../types").Recurrence,
): string {
  const base = parseISO(dueDate);
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
  return format(next, "yyyy-MM-dd");
}

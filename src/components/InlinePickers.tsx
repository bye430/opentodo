import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { dismissKeyboard } from "../lib/dismissKeyboard";
import { parseYmd } from "../lib/dates";
import { isMobileUi } from "../lib/platform";
import { IconDueDate, IconReminder } from "./icons";
import { ClockPickerModal } from "./ClockPickerModal";
import { Time24Input } from "./Time24Input";

const pickerCard =
  "overflow-hidden rounded-xl border border-border/70 bg-surface shadow-sm";

const dayCellBase =
  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors";
function formatYmdLabel(ymd: string | null): string {
  if (!ymd) return "选择日期";
  const d = parseYmd(ymd);
  return format(d, "M月d日 EEE", { locale: zhCN });
}

function formatHmLabel(hm: string): string {
  if (!hm) return "选择时间";
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h)) return "选择时间";
  return `${h}:${String(m ?? 0).padStart(2, "0")}`;
}

type DatePickerProps = {
  value: string | null;
  onChange: (ymd: string | null) => void;
  defaultOpen?: boolean;
};

export function InlineDatePicker({
  value,
  onChange,
  defaultOpen = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const anchor = value ? parseYmd(value) : new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(anchor));

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [viewMonth]);

  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-surface px-3 py-2.5 text-left transition-colors hover:border-[rgb(var(--accent)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)/0.35)]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <IconDueDate size={18} className="shrink-0 text-[rgb(var(--accent))]" />
        <span
          className={`min-w-0 flex-1 text-sm font-semibold ${
            value ? "text-foreground" : "text-muted"
          }`}
        >
          {formatYmdLabel(value)}
        </span>
        <span
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className={pickerCard}>
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="上个月"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-foreground">
              {format(viewMonth, "yyyy年 M月", { locale: zhCN })}
            </span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="下个月"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 text-center">
            {weekLabels.map((w) => (
              <span
                key={w}
                className="pb-1 text-[10px] font-semibold text-muted"
              >
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
            {weeks.flat().map((day) => {
              const ymd = format(day, "yyyy-MM-dd");
              const selected = value ? isSameDay(day, parseYmd(value)) : false;
              const inMonth = isSameMonth(day, viewMonth);
              const today = isToday(day);
              return (
                <button
                  key={ymd}
                  type="button"
                  className={`mx-auto ${dayCellBase} ${
                    selected
                      ? "bg-[rgb(var(--accent))] text-white shadow-sm"
                      : today && inMonth
                        ? "ring-1 ring-[rgb(var(--accent)/0.5)] text-[rgb(var(--accent))]"
                        : inMonth
                          ? "text-foreground hover:bg-[rgb(var(--accent)/0.12)]"
                          : "text-muted/40"
                  }`}
                  onClick={() => {
                    onChange(ymd);
                    setOpen(false);
                  }}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type TimePickerProps = {
  value: string;
  onChange: (hm: string) => void;
  defaultOpen?: boolean;
};

export function InlineTimePicker({
  value,
  onChange,
  defaultOpen = false,
}: TimePickerProps) {
  const mobile = isMobileUi();
  const [open, setOpen] = useState(defaultOpen);

  if (!mobile) {
    return (
      <div className="space-y-1.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <IconReminder size={12} />
          时间
        </span>
        <Time24Input value={value || "09:00"} onChange={onChange} />
      </div>
    );
  }

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    dismissKeyboard();
    setOpen(true);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-surface px-3 py-2.5 text-left transition-colors hover:border-[rgb(var(--accent)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)/0.35)]"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <IconReminder size={18} className="shrink-0 text-[rgb(var(--accent))]" />
        <span
          className={`min-w-0 flex-1 text-sm font-semibold tabular-nums ${
            value ? "text-foreground" : "text-muted"
          }`}
        >
          {formatHmLabel(value)}
        </span>
        <span
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <ClockPickerModal
        open={open}
        value={value || "09:00"}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { IconReminder } from "./icons";
import { InlineDatePicker, InlineTimePicker } from "./InlinePickers";
import {
  formatReminderLabel,
  reminderInOneHour,
  reminderTonight20,
  reminderTomorrowMorning,
  toReminderIso,
} from "../lib/taskReminder";
import { nextWeekYmd, todayYmd, tomorrowYmd } from "../lib/datePresets";
import { ymdFromDate } from "../lib/dates";

const cardClass =
  "rounded-xl border border-border/70 bg-gradient-to-b from-surface/80 to-surface/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:from-white/[0.04] dark:to-transparent";

const chipBase =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
const chipIdle =
  `${chipBase} border-border/80 bg-surface text-foreground/85 hover:border-[rgb(var(--accent)/0.35)] hover:bg-[rgb(var(--accent)/0.06)]`;
const chipActive =
  `${chipBase} border-[rgb(var(--accent)/0.45)] bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))] shadow-sm`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoToYmdHm(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: ymdFromDate(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function ymdHmToIso(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || "09:00";
  const ms = new Date(`${date}T${t}`).getTime();
  return Number.isNaN(ms) ? null : toReminderIso(ms);
}

function PresetChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? chipActive : chipIdle}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type DueEditorProps = {
  dueDate: string | null;
  onDueDate: (v: string | null) => void;
  compact?: boolean;
};

export function DueDateEditor({
  dueDate,
  onDueDate,
  compact = false,
}: DueEditorProps) {
  const activeToday = dueDate === todayYmd();
  const activeTomorrow = dueDate === tomorrowYmd();
  const activeNextWeek = dueDate === nextWeekYmd();

  return (
    <div className={`${cardClass} ${compact ? "space-y-2.5" : "space-y-3"}`}>
      <div className="flex flex-wrap gap-1.5">
        <PresetChip
          active={activeToday}
          onClick={() => onDueDate(todayYmd())}
        >
          今天
        </PresetChip>
        <PresetChip
          active={activeTomorrow}
          onClick={() => onDueDate(tomorrowYmd())}
        >
          明天
        </PresetChip>
        <PresetChip
          active={activeNextWeek}
          onClick={() => onDueDate(nextWeekYmd())}
        >
          下周
        </PresetChip>
        {dueDate ? (
          <button
            type="button"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
            onClick={() => onDueDate(null)}
          >
            清除
          </button>
        ) : null}
      </div>
      <InlineDatePicker value={dueDate} onChange={onDueDate} />
    </div>
  );
}

const reminderPresets = [
  { id: "1h", label: "1 小时后", get: reminderInOneHour },
  { id: "tonight", label: "今晚 20:00", get: reminderTonight20 },
  { id: "tomorrow", label: "明天 9:00", get: reminderTomorrowMorning },
] as const;

function activePresetId(reminderAt: string | null): string | null {
  if (!reminderAt) return null;
  for (const p of reminderPresets) {
    if (p.get() === reminderAt) return p.id;
  }
  return null;
}

type ReminderEditorProps = {
  reminderAt: string | null;
  onChange: (iso: string | null) => void;
  compact?: boolean;
};

export function ReminderTimeEditor({
  reminderAt,
  onChange,
  compact = false,
}: ReminderEditorProps) {
  const activeId = activePresetId(reminderAt);
  const { date, time } = isoToYmdHm(reminderAt);

  const setDate = (d: string | null) => {
    if (!d) {
      onChange(null);
      return;
    }
    onChange(ymdHmToIso(d, time || "09:00"));
  };

  const setTime = (t: string) => {
    if (!date && !t) {
      onChange(null);
      return;
    }
    onChange(ymdHmToIso(date || ymdFromDate(new Date()), t));
  };

  return (
    <div className={`${cardClass} ${compact ? "space-y-2.5" : "space-y-3"}`}>
      {reminderAt ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[rgb(var(--accent)/0.1)] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <IconReminder size={16} className="shrink-0 text-[rgb(var(--accent))]" />
            <span className="truncate text-sm font-semibold text-[rgb(var(--accent))]">
              {formatReminderLabel(reminderAt)}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-muted hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/10"
            onClick={() => onChange(null)}
          >
            清除
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {reminderPresets.map((p) => (
          <PresetChip
            key={p.id}
            active={activeId === p.id}
            onClick={() => onChange(p.get())}
          >
            {p.label}
          </PresetChip>
        ))}
      </div>

      <div className={`space-y-2 ${compact ? "" : ""}`}>
        <InlineDatePicker
          value={date || null}
          onChange={(d) => setDate(d)}
        />
        <InlineTimePicker value={time} onChange={setTime} />
      </div>
    </div>
  );
}

import { IconReminder } from "./icons";
import { parseHm } from "./ClockTimePicker";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hmFromParts(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function clampHour(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(23, Math.max(0, Math.round(v)));
}

function clampMinute(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(59, Math.max(0, Math.round(v)));
}

const fieldWrap =
  "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/80 bg-surface px-2.5 py-2 focus-within:border-[rgb(var(--accent)/0.45)] focus-within:ring-2 focus-within:ring-[rgb(var(--accent)/0.2)]";

const fieldInput =
  "w-full min-w-0 border-0 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none";

type Props = {
  value: string;
  onChange: (hm: string) => void;
};

/** 桌面 / 网页：24 小时制数字输入 */
export function Time24Input({ value, onChange }: Props) {
  const { hour, minute } = parseHm(value || "09:00");

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className={`${fieldWrap} max-w-[5rem]`}>
          <input
            type="number"
            min={0}
            max={23}
            className={fieldInput}
            value={hour}
            aria-label="小时（0–23）"
            onChange={(e) => {
              const h = clampHour(Number(e.target.value));
              onChange(hmFromParts(h, minute));
            }}
          />
        </div>
        <span className="text-lg font-bold text-muted">:</span>
        <div className={`${fieldWrap} max-w-[5rem]`}>
          <input
            type="number"
            min={0}
            max={59}
            className={fieldInput}
            value={minute}
            aria-label="分钟（0–59）"
            onChange={(e) => {
              const m = clampMinute(Number(e.target.value));
              onChange(hmFromParts(hour, m));
            }}
          />
        </div>
      </div>
      <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted sm:inline">
        24 小时制
      </span>
      <IconReminder size={16} className="shrink-0 text-muted sm:hidden" aria-hidden />
    </div>
  );
}

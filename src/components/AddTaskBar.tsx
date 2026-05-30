import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useAppStore } from "../store/appStore";
import type { Recurrence } from "../types";
import type { AddTaskDraftOptions } from "../lib/addTaskOptions";
import { formatReminderLabel } from "../lib/taskReminder";
import { todayYmd } from "../lib/datePresets";
import { isAndroid, isMobileUi } from "../lib/platform";
import { rescheduleAndroidReminders } from "../lib/androidReminders";
import { isClockPickerOpen } from "../lib/dismissKeyboard";
import {
  bindAddTaskPickCloser,
  registerBackHandler,
  setAddTaskPickPanelOpen,
} from "../lib/appNavigation";
import { useKeyboardInset } from "../lib/useKeyboardInset";
import { DueDateEditor } from "./DateTimePickUI";
import { ReminderQuickPick } from "./ReminderQuickPick";
import { IconDueDate, IconReminder, IconRepeat } from "./icons";

const recCycle: { v: Recurrence; label: string }[] = [
  { v: "none", label: "不重复" },
  { v: "daily", label: "每天" },
  { v: "weekly", label: "每周" },
  { v: "monthly", label: "每月" },
];

const actionBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10";
const actionBtnActive =
  "inline-flex items-center gap-1.5 rounded-full border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)] px-3 py-1.5 text-xs font-medium text-[rgb(var(--accent))]";

export function AddTaskBar() {
  const addTask = useAppStore((s) => s.addTask);
  const currentView = useAppStore((s) => s.currentView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelsOpenRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderAt, setReminderAt] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showReminderPanel, setShowReminderPanel] = useState(false);

  const mobile = isMobileUi();
  const android = isAndroid();
  const keyboardInset = useKeyboardInset(focused && mobile);
  const useFixedDock = focused && mobile && !android;
  const docked = useFixedDock && !sidebarOpen;

  const resetDraft = useCallback(() => {
    setTitle("");
    setDueDate(null);
    setReminderAt(null);
    setRecurrence("none");
    setShowDuePanel(false);
    setShowReminderPanel(false);
  }, []);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const opts: AddTaskDraftOptions = {};
    if (dueDate) opts.dueDate = dueDate;
    if (recurrence !== "none") opts.recurrence = recurrence;
    if (reminderAt) opts.reminderAt = reminderAt;
    addTask(trimmed, opts);
    resetDraft();
    rescheduleAndroidReminders();
    inputRef.current?.blur();
  }, [title, dueDate, recurrence, reminderAt, addTask, resetDraft]);

  const cycleRecurrence = () => {
    const i = recCycle.findIndex((r) => r.v === recurrence);
    const next = recCycle[(i + 1) % recCycle.length];
    setRecurrence(next.v);
  };

  const recLabel =
    recurrence === "none"
      ? "重复"
      : recCycle.find((r) => r.v === recurrence)?.label ?? "重复";

  const dueLabel = dueDate ? `截止 ${dueDate}` : "截止日期";

  const reminderLabel = reminderAt
    ? formatReminderLabel(reminderAt)
    : "提醒我";

  useEffect(() => {
    if (currentView.kind === "planned" && !dueDate) {
      setDueDate(todayYmd());
    }
  }, [currentView.kind, dueDate]);

  useEffect(() => {
    if (!sidebarOpen) return;
    setFocused(false);
    setShowDuePanel(false);
    setShowReminderPanel(false);
    inputRef.current?.blur();
  }, [sidebarOpen]);

  const closePickPanels = useCallback(() => {
    setShowDuePanel(false);
    setShowReminderPanel(false);
  }, []);

  useEffect(() => {
    const open = showDuePanel || showReminderPanel;
    panelsOpenRef.current = open;
    setAddTaskPickPanelOpen(open);
    return () => {
      panelsOpenRef.current = false;
      setAddTaskPickPanelOpen(false);
    };
  }, [showDuePanel, showReminderPanel]);

  useEffect(() => bindAddTaskPickCloser(closePickPanels), [closePickPanels]);

  useEffect(
    () =>
      registerBackHandler(() => {
        if (!showDuePanel && !showReminderPanel) return false;
        closePickPanels();
        return true;
      }),
    [showDuePanel, showReminderPanel, closePickPanels],
  );

  const showToolbar = focused || docked;

  const keepInputFocus = (e: MouseEvent | PointerEvent) => {
    e.preventDefault();
  };

  const toggleDuePanel = () => {
    setShowDuePanel((v) => !v);
    setShowReminderPanel(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const toggleReminderPanel = () => {
    setShowReminderPanel((v) => !v);
    setShowDuePanel(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const bar = (
    <div
      className={`no-print border-t border-border bg-elevated shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] ${
        docked ? "fixed left-0 right-0 z-[45]" : "shrink-0"
      }`}
      style={docked ? { bottom: keyboardInset } : undefined}
    >
      {showReminderPanel && showToolbar && (
        <div className="border-b border-border/60 bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.02]">
          <ReminderQuickPick
            compact
            reminderAt={reminderAt}
            onChange={setReminderAt}
          />
        </div>
      )}

      {showDuePanel && showToolbar && (
        <div className="border-b border-border/60 bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.02]">
          <DueDateEditor compact dueDate={dueDate} onDueDate={setDueDate} />
        </div>
      )}

      <div className="px-3 py-2.5">
        {showToolbar && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={
                reminderAt || showReminderPanel ? actionBtnActive : actionBtn
              }
              onMouseDown={keepInputFocus}
              onPointerDown={keepInputFocus}
              onClick={toggleReminderPanel}
            >
              <IconReminder size={14} className="shrink-0" />
              {reminderLabel}
            </button>
            <button
              type="button"
              className={dueDate || showDuePanel ? actionBtnActive : actionBtn}
              onMouseDown={keepInputFocus}
              onPointerDown={keepInputFocus}
              onClick={toggleDuePanel}
            >
              <IconDueDate size={14} className="shrink-0" />
              {dueLabel}
            </button>
            <button
              type="button"
              className={recurrence !== "none" ? actionBtnActive : actionBtn}
              onMouseDown={keepInputFocus}
              onPointerDown={keepInputFocus}
              onClick={() => {
                cycleRecurrence();
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <IconRepeat size={14} className="shrink-0" />
              {recLabel}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id="todo-add-task"
              ref={inputRef}
              type="text"
              value={title}
              placeholder="添加任务"
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-3 pr-12 text-sm outline-none ring-[rgb(var(--accent))] focus:ring-2"
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (document.activeElement?.closest("[data-add-task-bar]")) {
                    return;
                  }
                  if (panelsOpenRef.current && !isClockPickerOpen()) {
                    inputRef.current?.focus();
                    return;
                  }
                  if (isClockPickerOpen()) {
                    return;
                  }
                  setFocused(false);
                  setShowDuePanel(false);
                  setShowReminderPanel(false);
                }, 150);
              }}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              aria-label="添加任务"
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-[rgb(var(--accent))] text-sm font-semibold text-white disabled:opacity-40"
              disabled={!title.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              aria-label="确认添加"
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div data-add-task-bar className="shrink-0">
      {docked && (
        <button
          type="button"
          className="fixed inset-0 z-[44] bg-black/20 md:hidden"
          aria-label="关闭输入"
          onClick={() => inputRef.current?.blur()}
        />
      )}
      {bar}
      {docked && <div className="h-0 shrink-0" aria-hidden />}
    </div>
  );
}

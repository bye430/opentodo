import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useAppStore } from "../store/appStore";
import type { Recurrence } from "../types";
import { todayYmd } from "../lib/dates";
import { rescheduleAndroidReminders } from "../lib/androidReminders";
import { closeTaskDetail } from "../lib/appNavigation";
import { isMobileUi } from "../lib/platform";
import { DueDateEditor } from "./DateTimePickUI";
import { ReminderQuickPick } from "./ReminderQuickPick";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconBack, IconDueDate, IconReminder, IconRepeat } from "./icons";

const recOptions: { v: Recurrence; label: string }[] = [
  { v: "none", label: "不重复" },
  { v: "daily", label: "每天" },
  { v: "weekly", label: "每周" },
  { v: "monthly", label: "每月" },
];

const inputBase =
  "rounded-lg border border-border bg-surface text-sm text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]";

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border/70 pb-4 last:border-b-0">
      <h3
        className={`mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted ${
          icon ? "flex items-center gap-1.5" : ""
        }`}
      >
        {icon ? <span className="text-current">{icon}</span> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-surface/60 px-3 py-2.5">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
        checked={checked}
        onChange={onChange}
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );
}

export function TaskPane() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    tasks,
    selectedTaskId,
    updateTask,
    deleteTask,
    addStep,
    toggleStep,
    removeStep,
    toggleMyDay,
    addAttachment,
    removeAttachment,
    taskPaneOpen,
  } = useAppStore();
  const mobile = isMobileUi();

  const [stepDraft, setStepDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  );

  const patch = (id: string, p: Parameters<typeof updateTask>[1]) => {
    updateTask(id, p);
    rescheduleAndroidReminders();
  };

  if (!task) {
    return (
      <aside
        className={`no-print hidden w-[340px] shrink-0 flex-col border-l border-border bg-elevated md:flex ${
          taskPaneOpen ? "max-md:flex max-md:w-full" : ""
        }`}
        aria-label="任务详情"
      >
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
          选择一项任务
        </div>
      </aside>
    );
  }

  const onMyDay = todayYmd();
  const inMyDay = task.myDayDate === onMyDay;

  return (
    <aside
      className={`no-print flex w-full max-w-[400px] shrink-0 flex-col border-l border-border bg-elevated md:max-w-[360px] ${
        taskPaneOpen ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:max-w-none" : "max-md:hidden"
      } md:relative md:flex`}
      aria-label="任务详情"
    >
      {mobile && (
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/[0.08]"
            aria-label="返回"
            onClick={() => closeTaskDetail()}
          >
            <IconBack />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            详情
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b border-border/70 px-4 py-4">
          <input
            className="w-full border-0 bg-transparent p-0 text-xl font-semibold leading-snug text-foreground outline-none placeholder:text-muted/60 focus:ring-0"
            value={task.title}
            placeholder="任务名称"
            onChange={(e) => patch(task.id, { title: e.target.value })}
            aria-label="标题"
          />
        </div>

        <div className="space-y-0 px-4 py-4">
          <DetailSection title="步骤">
            <div className="space-y-1.5">
              {task.steps.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-2 py-1"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                    checked={s.completed}
                    onChange={() => toggleStep(task.id, s.id)}
                  />
                  <input
                    className={`min-w-0 flex-1 border-0 bg-transparent py-1 text-sm outline-none ${
                      s.completed
                        ? "text-muted line-through"
                        : "font-medium text-foreground"
                    }`}
                    value={s.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      patch(task.id, {
                        steps: task.steps.map((x) =>
                          x.id === s.id ? { ...x, title } : x,
                        ),
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-muted hover:text-red-600"
                    onClick={() => removeStep(task.id, s.id)}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                className={`min-w-0 flex-1 ${inputBase} px-3 py-2`}
                placeholder="添加步骤…"
                value={stepDraft}
                onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && stepDraft.trim()) {
                    addStep(task.id, stepDraft.trim());
                    setStepDraft("");
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-sm font-semibold text-[rgb(var(--accent))]"
                onClick={() => {
                  if (stepDraft.trim()) {
                    addStep(task.id, stepDraft.trim());
                    setStepDraft("");
                  }
                }}
              >
                添加
              </button>
            </div>
          </DetailSection>

          <DetailSection title="标记">
            <div className="flex flex-col gap-2">
              <ToggleRow
                label="重要"
                checked={task.starred}
                onChange={() => patch(task.id, { starred: !task.starred })}
              />
              <ToggleRow
                label="我的一天"
                checked={inMyDay}
                onChange={() => {
                  toggleMyDay(task.id);
                  rescheduleAndroidReminders();
                }}
              />
            </div>
          </DetailSection>

          <DetailSection
            title="截止"
            icon={<IconDueDate size={14} />}
          >
            <DueDateEditor
              dueDate={task.dueDate}
              onDueDate={(dueDate) =>
                patch(task.id, { dueDate, dueTime: null })
              }
            />
          </DetailSection>

          <DetailSection
            title="提醒我"
            icon={<IconReminder size={14} />}
          >
            <ReminderQuickPick
              reminderAt={task.reminderAt}
              onChange={(iso) => patch(task.id, { reminderAt: iso })}
            />
          </DetailSection>

          <DetailSection
            title="重复"
            icon={<IconRepeat size={14} />}
          >
            <select
              className={`w-full ${inputBase} px-3 py-2 font-medium`}
              value={task.recurrence}
              onChange={(e) =>
                patch(task.id, { recurrence: e.target.value as Recurrence })
              }
            >
              {recOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </DetailSection>

          <DetailSection title="备注">
            <textarea
              rows={3}
              className={`w-full resize-y ${inputBase} px-3 py-2 leading-relaxed`}
              placeholder="备注…"
              value={task.notes}
              onChange={(e) => patch(task.id, { notes: e.target.value })}
            />
          </DetailSection>

          <DetailSection title="附件">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await addAttachment(task.id, f);
              }}
            />
            <button
              type="button"
              className="text-sm font-semibold text-[rgb(var(--accent))]"
              onClick={() => fileRef.current?.click()}
            >
              + 添加附件
            </button>
            {task.attachments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {task.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 px-2 py-1.5 text-sm"
                  >
                    <a
                      className="min-w-0 truncate font-medium text-[rgb(var(--accent))] underline-offset-2 hover:underline"
                      href={`data:${a.mime};base64,${a.dataBase64}`}
                      download={a.name}
                    >
                      {a.name}
                    </a>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-muted hover:text-red-600"
                      onClick={() => removeAttachment(task.id, a.id)}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </div>

        <div className="mt-auto border-t border-border px-4 py-4">
          <button
            type="button"
            className="w-full rounded-lg border border-red-200/80 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
            onClick={() => setConfirmDelete(true)}
          >
            删除任务
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除任务？"
        description={`将删除「${task.title.trim() || "（无标题）"}」，此操作无法撤销。`}
        confirmText="删除"
        variant="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteTask(task.id);
          closeTaskDetail();
        }}
      />
    </aside>
  );
}

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAppStore } from "../store/appStore";
import type { ThemeMode } from "../types";
import {
  DEFAULT_REMINDER_POLICY,
  normalizeReminderPolicy,
} from "../lib/dueSoonNotify";
import { bindAppMenuCloser, setAppMenuOpen } from "../lib/appNavigation";
import { isAndroid } from "../lib/platform";
import { readStorageMeta, writeStorageMeta, type StorageMeta } from "../lib/storageMeta";
import type { ReminderPolicy } from "../types";
import { IconGear } from "./icons";

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]";

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const [schedulerRegistered, setSchedulerRegistered] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const exportJson = useAppStore((s) => s.exportJson);
  const importJson = useAppStore((s) => s.importJson);
  const reminderPolicy = useAppStore((s) => s.reminderPolicy);
  const setReminderPolicy = useAppStore((s) => s.setReminderPolicy);
  const [policyDraft, setPolicyDraft] = useState<ReminderPolicy>(reminderPolicy);
  const [storageMetaDraft, setStorageMetaDraft] = useState<StorageMeta>(readStorageMeta());

  const patchPolicy = (patch: Partial<ReminderPolicy>) => {
    setPolicyDraft((p) => ({ ...p, ...patch }));
  };

  const applyReminderPolicy = () => {
    setReminderPolicy(normalizeReminderPolicy(policyDraft));
    setOpen(false);
  };

  useEffect(() => setAppMenuOpen(open), [open]);

  useEffect(() => bindAppMenuCloser(() => setOpen(false)), []);

  useEffect(() => {
    if (!open) return;
    setPolicyDraft(reminderPolicy);
    setStorageMetaDraft(readStorageMeta());
    const sch = window.todoScheduler;
    if (sch) {
      void sch.status().then((s) => setSchedulerRegistered(!!s.registered));
    } else {
      setSchedulerRegistered(false);
    }
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    try {
      if (!confirm("导入将覆盖当前所有数据，确定？")) return;
      importJson(text);
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "导入失败");
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-black/5 dark:hover:bg-white/[0.08]"
        aria-label="设置"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <IconGear />
      </button>

      {open && (
        <div
          className="absolute right-0 z-[70] mt-1 min-w-[240px] rounded-lg border border-border bg-elevated py-1 shadow-lg"
          role="menu"
        >
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-foreground">临期通知（全局）</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              为有截止日的未完成任务自动发送状态栏通知。
            </p>
            
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] text-foreground">
                  <p className="font-medium">首次提醒</p>
                  <p className="text-muted">截止前几天</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
                  value={policyDraft.daysBeforeFirst}
                  onChange={(e) =>
                    patchPolicy({
                      daysBeforeFirst: Number(e.target.value),
                    })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] text-foreground">
                  <p className="font-medium">二次提醒</p>
                  <p className="text-muted">截止前几天</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
                  value={policyDraft.daysBeforeSecond}
                  onChange={(e) =>
                    patchPolicy({
                      daysBeforeSecond: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] text-foreground">
                  <p className="font-medium">冲刺期提醒</p>
                  <p className="text-muted">最后 N 小时内</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
                  value={policyDraft.finalHoursBeforeDue}
                  onChange={(e) =>
                    patchPolicy({
                      finalHoursBeforeDue: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] text-foreground">
                  <p className="font-medium">冲刺期间隔</p>
                  <p className="text-muted">每隔 N 小时</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
                  value={policyDraft.finalIntervalHours}
                  onChange={(e) =>
                    patchPolicy({
                      finalIntervalHours: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-[rgb(var(--accent))] py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                onClick={applyReminderPolicy}
              >
                保存设置
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-border bg-surface py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]"
                onClick={() => setPolicyDraft(DEFAULT_REMINDER_POLICY)}
              >
                恢复默认
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-snug text-muted">
              {isAndroid()
                ? "需允许通知与精确闹钟权限；首次启动会请求通知权限。"
                : window.todoNotify
                  ? "桌面版由系统通知弹出；可注册后台定时任务。"
                  : "网页版请允许浏览器通知；标签页关闭后无法提醒。"}
            </p>
            {isAndroid() && window.todoAndroid ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] leading-snug text-muted">
                  Android 若提醒不准，请在系统中允许通知、精确闹钟，并放宽省电限制。
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => void window.todoAndroid?.openNotificationSettings()}
                >
                  打开通知设置
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => void window.todoAndroid?.openBatterySettings()}
                >
                  打开省电 / 电池设置
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={async () => {
                    const r = await window.todoReminders?.reschedule();
                    alert(r?.ok ? "已重新调度提醒闹钟" : r?.error ?? "调度失败");
                  }}
                >
                  重新调度提醒
                </button>
              </div>
            ) : null}
            {window.todoScheduler ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-muted">
                  系统后台状态：
                  <span className="ml-1 font-mono text-foreground">
                    {schedulerRegistered ? "已注册" : "未注册"}
                  </span>
                  {window.desktop?.platform === "win32"
                    ? "（Windows 当前版本未接入自动注册，仅前台轮询）"
                    : null}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  disabled={window.desktop?.platform === "win32"}
                  onClick={async () => {
                    const sch = window.todoScheduler;
                    if (!sch) return;
                    const r = await sch.register();
                    if (!r.ok) {
                      alert(r.error ?? "注册失败");
                      return;
                    }
                    const st = await sch.status();
                    setSchedulerRegistered(!!st.registered);
                    alert(
                      r.kind === "systemd"
                        ? "已写入 systemd 用户单元并尝试 enable --now。若从未启用过用户定时器，可执行：loginctl enable-linger $USER"
                        : "已写入 LaunchAgents 并已由 launchctl 加载。",
                    );
                  }}
                >
                  自动注册系统后台提醒
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`${itemClass} text-amber-700 dark:text-amber-400`}
                  disabled={!schedulerRegistered}
                  onClick={async () => {
                    const sch = window.todoScheduler;
                    if (!sch) return;
                    if (!confirm("将移除已注册的后台定时任务（systemd / launchd），确定？")) return;
                    const r = await sch.unregister();
                    if (!r.ok) {
                      alert(r.error ?? "移除失败");
                      return;
                    }
                    const st = await sch.status();
                    setSchedulerRegistered(!!st.registered);
                  }}
                >
                  移除已注册的后台任务
                </button>
              </div>
            ) : null}
          </div>

          <div className="my-1 border-t border-border" />

          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-foreground">数据安全</p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  className="rounded border-border text-[rgb(var(--accent))] focus:ring-[rgb(var(--accent)/0.35)]"
                  checked={storageMetaDraft.encrypt}
                  onChange={(e) => {
                    const next = { ...storageMetaDraft, encrypt: e.target.checked };
                    setStorageMetaDraft(next);
                    writeStorageMeta(next);
                    // 触发重新保存以应用或取消加密
                    useAppStore.setState((s) => ({ ...s }));
                  }}
                />
                加密本地数据文件
              </label>
              {storageMetaDraft.encrypt && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted">加密密码（用于跨设备同步解密）</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
                    value={storageMetaDraft.encryptPassword || ""}
                    onChange={(e) => {
                      const next = { ...storageMetaDraft, encryptPassword: e.target.value };
                      setStorageMetaDraft(next);
                      writeStorageMeta(next);
                    }}
                    onBlur={() => {
                      // 失去焦点时重新保存数据
                      useAppStore.setState((s) => ({ ...s }));
                    }}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md border border-border bg-surface py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]"
                onClick={() => {
                  exportJson();
                  setOpen(false);
                }}
              >
                导出 JSON
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-border bg-surface py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]"
                onClick={() => importRef.current?.click()}
              >
                导入 JSON…
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onImport}
              />
            </div>
          </div>

          <div className="my-1 border-t border-border" />

          <div className="px-3 py-2">
            <label className="block text-xs text-muted">主题</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as ThemeMode)
              }
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

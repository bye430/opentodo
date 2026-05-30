import { useEffect, useState } from "react";
import { useAppStore } from "./store/appStore";
import {
  findDueSoonToNotify,
  findTaskRemindersDue,
} from "./lib/reminderScheduler";
import { showTodoNotification } from "./lib/systemNotify";
import { isAndroid } from "./lib/platform";
import { startAndroidKeyboardInsetSync } from "./lib/androidKeyboardInset";
import { toggleSidebar, closeSidebar } from "./lib/appNavigation";
import { applyTodoLaunch, registerTodoLaunchHandler } from "./lib/todoLaunch";
import { registerAndroidBackHandler, unregisterAndroidBackHandler } from "./lib/androidShell";
import { syncAppStateFromAndroidDisk } from "./lib/androidPersistSync";
import { rescheduleAndroidReminders } from "./lib/androidReminders";
import {
  formatDueSoonTitle,
  patchAfterDueSoonNotify,
} from "./lib/dueSoonNotify";
import { patchAfterTaskReminderFire } from "./lib/taskReminder";
import { AppLogo } from "./components/AppLogo";
import { Sidebar } from "./components/Sidebar";
import { ListPane } from "./components/ListPane";
import { TaskPane } from "./components/TaskPane";
import { AppMenu } from "./components/AppMenu";
import { IconDrawer } from "./components/icons";
import type { ThemeMode } from "./types";

function applyInitialTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "light") root.classList.add("light");
  else {
    root.classList.toggle(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }
}

function usePersistHydrated() {
  const [ready, setReady] = useState(() => useAppStore.persist.hasHydrated());
  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useAppStore.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

export function App() {
  const persistReady = usePersistHydrated();
  const theme = useAppStore((s) => s.theme);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const onToggleSidebar = () => {
    if (!sidebarOpen) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    toggleSidebar();
  };

  useEffect(() => {
    applyInitialTheme(theme);
  }, [theme]);

  useEffect(() => {
    registerAndroidBackHandler();
    return () => unregisterAndroidBackHandler();
  }, []);

  useEffect(() => startAndroidKeyboardInsetSync(), []);

  useEffect(() => {
    if (!persistReady) return;
    const teardownLaunch = registerTodoLaunchHandler();
    const launch = window.todoLaunch;
    if (launch) {
      delete window.todoLaunch;
      applyTodoLaunch(launch);
    }
    void rescheduleAndroidReminders();
    return teardownLaunch;
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    const unsub = window.todoNotify?.onOpenTask?.((taskId) => {
      applyTodoLaunch({ taskId });
    });
    return () => unsub?.();
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    const intervalMs = isAndroid() ? 120_000 : 30_000;
    const run = async () => {
      if (isAndroid()) {
        await syncAppStateFromAndroidDisk((partial) => {
          useAppStore.setState(partial);
        });
      }
      const { tasks, lists, reminderPolicy, updateTask } =
        useAppStore.getState();
      if (!isAndroid()) {
        const dueSoon = findDueSoonToNotify(tasks, lists, reminderPolicy);
        for (const { task, listName, fireAt, body } of dueSoon) {
          const subtitle = [listName ? `列表：${listName}` : "", body]
            .filter(Boolean)
            .join(" · ");
          await showTodoNotification(
            formatDueSoonTitle(task, fireAt),
            subtitle || undefined,
            task.id,
          );
          updateTask(task.id, patchAfterDueSoonNotify(task, fireAt));
        }
        const reminders = findTaskRemindersDue(tasks, lists);
        for (const { task, listName } of reminders) {
          const subtitle = listName ? `列表：${listName}` : undefined;
          await showTodoNotification(`提醒：${task.title}`, subtitle, task.id);
          updateTask(task.id, patchAfterTaskReminderFire(task));
        }
        if (dueSoon.length > 0 || reminders.length > 0) {
          rescheduleAndroidReminders();
        }
      }
    };
    void run();
    const id = window.setInterval(() => void run(), intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistReady]);

  if (!persistReady) {
    return (
      <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
        正在加载数据…
      </div>
    );
  }

  return (
    <div className="app-shell flex h-full min-h-0 flex-col">
      <header className="no-print relative z-50 hidden h-11 shrink-0 items-center gap-2 overflow-visible border-b border-border bg-elevated px-4 md:flex">
        <span className="mr-auto flex items-center gap-2 text-sm font-semibold text-[rgb(30_58_138)] dark:text-zinc-50">
          <AppLogo className="h-7 w-7 shrink-0" />
          TODO
        </span>
        <AppMenu />
      </header>

      <header className="no-print relative z-50 flex shrink-0 flex-col overflow-visible border-b border-border bg-elevated pt-[var(--safe-area-top)] md:hidden">
        <div className="flex h-11 items-center gap-1 px-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/[0.08]"
            onClick={onToggleSidebar}
            aria-expanded={sidebarOpen}
            aria-label="打开导航侧栏"
          >
            <IconDrawer />
          </button>
          <span className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-[rgb(30_58_138)] dark:text-zinc-50">
            <AppLogo className="h-7 w-7 shrink-0" />
            TODO
          </span>
          <AppMenu />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            type="button"
            className="no-print fixed inset-x-0 bottom-0 top-[var(--shell-header-offset)] z-40 bg-black/40 md:hidden"
            aria-label="关闭侧栏"
            onClick={() => closeSidebar()}
          />
        )}
        <Sidebar />
        <ListPane />
        <TaskPane />
      </div>
    </div>
  );
}

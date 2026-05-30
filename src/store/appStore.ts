import { create } from "zustand";
import type {
  AppStateV1,
  Attachment,
  List,
  ListGroup,
  ReminderPolicy,
  SmartView,
  Task,
  ThemeMode,
} from "../types";
import { newId } from "../lib/id";
import { todayYmd } from "../lib/dates";
import { buildExportPayload, parseImportJson } from "../lib/exportImport";
import type { AddTaskDraftOptions } from "../lib/addTaskOptions";
import {
  clearDueSoonSlotsIfDueChanged,
  DEFAULT_REMINDER_POLICY,
  migrateTaskDueSoonFields,
  normalizeReminderPolicy,
} from "../lib/dueSoonNotify";
import { buildRecurringCloneOnComplete } from "../lib/recurrenceClone";
import {
  clearReminderFireIfChanged,
} from "../lib/taskReminder";
import { rolloverIfNeeded } from "../lib/persistRollover";
import {
  DEFAULT_SIDEBAR_MOTTO,
  normalizeSidebarMotto,
} from "../lib/sidebarMotto";
import { createJSONStorage, persist } from "zustand/middleware";
import { rescheduleAndroidReminders } from "../lib/androidReminders";
import { getAppPersistStorage } from "../lib/persistStorage";

const MAX_ATTACH_BYTES = 400 * 1024;

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) =>
    migrateTaskDueSoonFields({
      ...t,
      dueSoonNotifiedSlots: t.dueSoonNotifiedSlots ?? t.reminderFiredSlots ?? [],
    }),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function seed(): Omit<AppStateV1, "exportedAt"> {
  const g1: ListGroup = {
    id: newId(),
    name: "",
    sortOrder: 0,
    collapsed: false,
  };
  const l1: List = {
    id: newId(),
    name: "任务",
    groupId: g1.id,
    sortOrder: 0,
    background: { type: "solid", value: "#1e3a8a" },
  };
  const l2: List = {
    id: newId(),
    name: "购物",
    groupId: g1.id,
    sortOrder: 1,
    background: { type: "none", value: "" },
  };
  const t1: Task = {
    id: newId(),
    listId: l1.id,
    title: "欢迎使用 TODO",
    notes: "数据保存在本机。使用「导出 JSON」可备份。",
    completed: false,
    starred: true,
    dueDate: todayYmd(),
    dueTime: null,
    reminderAt: null,
    reminderLastFiredAt: null,
    dueSoonNotifiedSlots: [],
    recurrence: "none",
    category: "",
    tags: "",
    sortOrder: 0,
    myDayDate: todayYmd(),
    steps: [
      { id: newId(), title: "试试勾选完成", completed: false, sortOrder: 0 },
    ],
    attachments: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return {
    version: 1,
    theme: "system",
    hideCompleted: false,
    sidebarMotto: DEFAULT_SIDEBAR_MOTTO,
    reminderPolicy: DEFAULT_REMINDER_POLICY,
    lastCalendarDate: todayYmd(),
    listGroups: [g1],
    lists: [l1, l2],
    tasks: [t1],
  };
}

function applyThemeClass(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }
  if (theme === "light") {
    root.classList.add("light");
    return;
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  root.classList.toggle("dark", mq.matches);
}

export type AppStore = AppStateV1 & {
  currentView: SmartView;
  selectedTaskId: string | null;
  sidebarOpen: boolean;
  taskPaneOpen: boolean;
  /** 侧栏搜索，非空时列表显示全局匹配任务 */
  searchQuery: string;
  setTheme: (t: ThemeMode) => void;
  setHideCompleted: (v: boolean) => void;
  setSidebarMotto: (motto: string) => void;
  setReminderPolicy: (policy: ReminderPolicy) => void;
  setCurrentView: (v: SmartView) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSidebarOpen: (v: boolean) => void;
  setTaskPaneOpen: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  addListGroup: (name: string) => void;
  renameListGroup: (id: string, name: string) => void;
  toggleGroupCollapsed: (id: string) => void;
  addList: (name: string, groupId?: string | null) => void;
  renameList: (id: string, name: string) => void;
  updateListBackground: (id: string, bg: List["background"]) => void;
  deleteList: (id: string) => void;
  addTask: (title: string, options?: AddTaskDraftOptions) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  addStep: (taskId: string, title: string) => void;
  toggleStep: (taskId: string, stepId: string) => void;
  removeStep: (taskId: string, stepId: string) => void;
  addAttachment: (taskId: string, file: File) => Promise<void>;
  removeAttachment: (taskId: string, attId: string) => void;
  toggleMyDay: (taskId: string) => void;
  exportJson: () => void;
  importJson: (text: string) => void;
  reorderListsInGroup: (groupId: string | null, orderedIds: string[]) => void;
  reorderLists: (orderedIds: string[]) => void;
  duplicateList: (listId: string) => void;
  moveTasksToList: (taskIds: string[], listId: string) => void;
  reorderTasksInView: (orderedIds: string[]) => void;
  /** SmartDiet 等外部 Agent 改盘后的热重载 */
  reloadFromDisk: () => Promise<void>;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...seed(),
      currentView: { kind: "my-day" },
      selectedTaskId: null,
      sidebarOpen: false,
      taskPaneOpen: false,
      searchQuery: "",

      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      setHideCompleted: (hideCompleted) => set({ hideCompleted }),

      setSidebarMotto: (motto) =>
        set({ sidebarMotto: normalizeSidebarMotto(motto) }),

      setReminderPolicy: (policy) => {
        const next = normalizeReminderPolicy(policy);
        set((s) => ({
          reminderPolicy: next,
          tasks: s.tasks.map((t) => ({
            ...t,
            dueSoonNotifiedSlots: [],
            updatedAt: nowIso(),
          })),
        }));
        rescheduleAndroidReminders();
      },

      setCurrentView: (currentView) =>
        set({ currentView, selectedTaskId: null, taskPaneOpen: false }),
      setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setTaskPaneOpen: (taskPaneOpen) => set({ taskPaneOpen }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addListGroup: (name) =>
        set((s) => ({
          listGroups: [
            ...s.listGroups,
            {
              id: newId(),
              name,
              sortOrder: s.listGroups.length,
              collapsed: false,
            },
          ],
        })),

      renameListGroup: (id, name) =>
        set((s) => ({
          listGroups: s.listGroups.map((g) => (g.id === id ? { ...g, name } : g)),
        })),

      toggleGroupCollapsed: (id) =>
        set((s) => ({
          listGroups: s.listGroups.map((g) =>
            g.id === id ? { ...g, collapsed: !g.collapsed } : g,
          ),
        })),

      addList: (name, groupId) =>
        set((s) => {
          let groups = s.listGroups;
          let gid = groupId ?? groups[0]?.id ?? null;
          if (!gid) {
            const g: ListGroup = {
              id: newId(),
              name: "",
              sortOrder: 0,
              collapsed: false,
            };
            groups = [g];
            gid = g.id;
          }
          return {
            listGroups: groups,
            lists: [
              ...s.lists,
              {
                id: newId(),
                name,
                groupId: gid,
                sortOrder: s.lists.filter((l) => l.groupId === gid).length,
                background: { type: "none", value: "" },
              },
            ],
          };
        }),

      renameList: (id, name) =>
        set((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)),
        })),

      updateListBackground: (id, background) =>
        set((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, background } : l)),
        })),

      deleteList: (id) =>
        set((s) => ({
          lists: s.lists.filter((l) => l.id !== id),
          tasks: s.tasks.filter((t) => t.listId !== id),
          currentView:
            s.currentView.kind === "list" && s.currentView.listId === id
              ? { kind: "my-day" }
              : s.currentView,
          selectedTaskId:
            s.tasks.find((t) => t.id === s.selectedTaskId)?.listId === id
              ? null
              : s.selectedTaskId,
        })),

      reorderListsInGroup: (groupId, orderedIds) =>
        set((s) => ({
          lists: s.lists.map((l) => {
            if (l.groupId !== groupId) return l;
            const i = orderedIds.indexOf(l.id);
            if (i === -1) return l;
            return { ...l, sortOrder: i };
          }),
        })),

      reorderLists: (orderedIds) =>
        set((s) => ({
          lists: s.lists.map((l) => {
            const i = orderedIds.indexOf(l.id);
            if (i === -1) return l;
            return { ...l, sortOrder: i };
          }),
        })),

      moveTasksToList: (taskIds, listId) => {
        if (taskIds.length === 0) return;
        set((s) => {
          const maxOrder = s.tasks
            .filter((t) => t.listId === listId)
            .reduce((m, t) => Math.max(m, t.sortOrder), -1);
          let next = maxOrder + 1;
          const idSet = new Set(taskIds);
          return {
            tasks: s.tasks.map((t) => {
              if (!idSet.has(t.id)) return t;
              const moved = {
                ...t,
                listId,
                sortOrder: next++,
                updatedAt: nowIso(),
              };
              return moved;
            }),
          };
        });
      },

      reorderTasksInView: (orderedIds) => {
        if (orderedIds.length === 0) return;
        set((s) => {
          const byList = new Map<string, string[]>();
          for (const id of orderedIds) {
            const t = s.tasks.find((x) => x.id === id);
            if (!t) continue;
            const arr = byList.get(t.listId) ?? [];
            arr.push(id);
            byList.set(t.listId, arr);
          }
          const orderMap = new Map<string, number>();
          for (const [, ids] of byList) {
            ids.forEach((id, i) => orderMap.set(id, i));
          }
          return {
            tasks: s.tasks.map((t) => {
              const o = orderMap.get(t.id);
              if (o === undefined) return t;
              return { ...t, sortOrder: o, updatedAt: nowIso() };
            }),
          };
        });
      },

      reloadFromDisk: async () => {
        let parsed: Partial<AppStore> | undefined;
        const storage = getAppPersistStorage();
        if (storage) {
          const val = (await storage.getItem("todo-persist")) as any;
          if (val && typeof val === "object" && val.state) {
            parsed = val.state;
          }
        }
        if (!parsed || !parsed.lists?.length) return;
        const base: AppStateV1 = {
          version: 1,
          theme: parsed.theme ?? "system",
          hideCompleted: parsed.hideCompleted ?? false,
          sidebarMotto: normalizeSidebarMotto(parsed.sidebarMotto),
          reminderPolicy: normalizeReminderPolicy(parsed.reminderPolicy),
          lastCalendarDate: parsed.lastCalendarDate ?? todayYmd(),
          listGroups: parsed.listGroups ?? [],
          lists: parsed.lists ?? [],
          tasks: normalizeTasks(parsed.tasks ?? []),
        };
        const rolled = rolloverIfNeeded(base);
        useAppStore.setState({
          ...rolled,
          currentView: get().currentView,
          selectedTaskId: get().selectedTaskId,
          sidebarOpen: get().sidebarOpen,
          taskPaneOpen: get().taskPaneOpen,
        });
      },

      duplicateList: (sourceId) => {
        const s = get();
        const src = s.lists.find((l) => l.id === sourceId);
        if (!src) return;
        const newListId = newId();
        const peers = s.lists.filter((l) => l.groupId === src.groupId);
        const maxOrder = peers.reduce((m, l) => Math.max(m, l.sortOrder), -1);
        const newList: List = {
          ...src,
          id: newListId,
          name: `${src.name} 副本`,
          sortOrder: maxOrder + 1,
        };
        const sourceTasks = s.tasks.filter((t) => t.listId === sourceId);
        const newTasks: Task[] = sourceTasks.map((t) => ({
          ...t,
          id: newId(),
          listId: newListId,
          myDayDate: null,
          steps: t.steps.map((st) => ({
            ...st,
            id: newId(),
          })),
          attachments: t.attachments.map((a) => ({
            ...a,
            id: newId(),
          })),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }));
        set({
          lists: [...s.lists, newList],
          tasks: [...s.tasks, ...newTasks],
          currentView: { kind: "list", listId: newListId },
          selectedTaskId: null,
        });
      },

      addTask: (title, options) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const s = get();
        const view = s.currentView;
        let listId: string;
        if (view.kind === "list") {
          listId = view.listId;
        } else {
          const first = s.lists[0];
          if (!first) return;
          listId = first.id;
        }
        const today = todayYmd();
        let starred = false;
        let dueDate: string | null = null;
        let myDayDate: string | null = null;
        let recurrence: Task["recurrence"] = "none";
        if (view.kind === "my-day") {
          myDayDate = today;
        } else if (view.kind === "important") {
          starred = true;
        } else if (view.kind === "planned") {
          dueDate = today;
        }
        if (options?.dueDate !== undefined) dueDate = options.dueDate;
        if (options?.recurrence !== undefined) {
          recurrence = options.recurrence;
        }
        const reminderAt =
          options?.reminderAt !== undefined ? options.reminderAt : null;
        const t: Task = {
          id: newId(),
          listId,
          title: trimmed,
          notes: "",
          completed: false,
          starred,
          dueDate,
          dueTime: null,
          reminderAt,
          reminderLastFiredAt: null,
          dueSoonNotifiedSlots: [],
          recurrence,
          category: "",
          tags: "",
          sortOrder: s.tasks.filter((x) => x.listId === listId).length,
          myDayDate,
          steps: [],
          attachments: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        const onAndroid =
          typeof window !== "undefined" &&
          window.desktop?.platform === "android";
        set({
          tasks: [...s.tasks, t],
          selectedTaskId: onAndroid ? null : t.id,
          taskPaneOpen: false,
        });
      },

      updateTask: (id, patch) => {
        const scheduleTouched =
          Object.prototype.hasOwnProperty.call(patch, "dueDate") ||
          Object.prototype.hasOwnProperty.call(patch, "dueTime") ||
          Object.prototype.hasOwnProperty.call(patch, "reminderAt") ||
          Object.prototype.hasOwnProperty.call(patch, "completed");
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            let merged = clearDueSoonSlotsIfDueChanged(t, patch);
            merged = clearReminderFireIfChanged(t, merged);
            const next: Task = { ...t, ...merged, updatedAt: nowIso() };
            return next;
          }),
        }));
        if (scheduleTouched) rescheduleAndroidReminders();
      },

      toggleTaskComplete: (id) => {
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return s;
          if (t.completed) {
            return {
              tasks: s.tasks.map((x) =>
                x.id === id
                  ? { ...x, completed: false, updatedAt: nowIso() }
                  : x,
              ),
            };
          }
          const completedTask = {
            ...t,
            completed: true,
            updatedAt: nowIso(),
          };
          let tasks = s.tasks.map((x) => (x.id === id ? completedTask : x));
          if (t.recurrence !== "none" && t.dueDate) {
            tasks = [...tasks, buildRecurringCloneOnComplete(t)];
          }
          return { tasks };
        });
        rescheduleAndroidReminders();
      },

      deleteTask: (id) => {
        const s = get();
        if (!s.tasks.some((x) => x.id === id)) return;
        set({
          tasks: s.tasks.filter((x) => x.id !== id),
          selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
          taskPaneOpen: s.selectedTaskId === id ? false : s.taskPaneOpen,
        });
        rescheduleAndroidReminders();
      },

      addStep: (taskId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  steps: [
                    ...t.steps,
                    {
                      id: newId(),
                      title: trimmed,
                      completed: false,
                      sortOrder: t.steps.length,
                    },
                  ],
                  updatedAt: nowIso(),
                }
              : t,
          ),
        }));
      },

      toggleStep: (taskId, stepId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  steps: t.steps.map((st) =>
                    st.id === stepId
                      ? { ...st, completed: !st.completed }
                      : st,
                  ),
                  updatedAt: nowIso(),
                }
              : t,
          ),
        })),

      removeStep: (taskId, stepId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  steps: t.steps.filter((st) => st.id !== stepId),
                  updatedAt: nowIso(),
                }
              : t,
          ),
        })),

      addAttachment: async (taskId, file) => {
        if (file.size > MAX_ATTACH_BYTES) {
          alert(`文件过大，单文件上限 ${MAX_ATTACH_BYTES / 1024}KB`);
          return;
        }
        const buf = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const dataBase64 = btoa(binary);
        const att: Attachment = {
          id: newId(),
          name: file.name,
          mime: file.type || "application/octet-stream",
          dataBase64,
          size: file.size,
        };
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  attachments: [...t.attachments, att],
                  updatedAt: nowIso(),
                }
              : t,
          ),
        }));
      },

      removeAttachment: (taskId, attId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  attachments: t.attachments.filter((a) => a.id !== attId),
                  updatedAt: nowIso(),
                }
              : t,
          ),
        })),

      toggleMyDay: (taskId) =>
        set((s) => {
          const d = todayYmd();
          return {
            tasks: s.tasks.map((t) => {
              if (t.id !== taskId) return t;
              const on = t.myDayDate === d;
              return {
                ...t,
                myDayDate: on ? null : d,
                updatedAt: nowIso(),
              };
            }),
          };
        }),

      exportJson: () => {
        const s = get();
        const payload = buildExportPayload({
          version: 1,
          theme: s.theme,
          hideCompleted: s.hideCompleted,
          sidebarMotto: s.sidebarMotto,
          reminderPolicy: s.reminderPolicy,
          lastCalendarDate: s.lastCalendarDate,
          listGroups: s.listGroups,
          lists: s.lists,
          tasks: s.tasks,
        });
        const name = `todo-backup-${todayYmd()}.json`;
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      },

      importJson: (text) => {
        const raw = parseImportJson(text);
        const data: AppStateV1 = {
          version: 1,
          theme: raw.theme ?? "system",
          hideCompleted: raw.hideCompleted ?? false,
          sidebarMotto: normalizeSidebarMotto(raw.sidebarMotto),
          reminderPolicy: normalizeReminderPolicy(raw.reminderPolicy),
          lastCalendarDate: raw.lastCalendarDate ?? todayYmd(),
          listGroups: raw.listGroups ?? [],
          lists: raw.lists ?? [],
          tasks: normalizeTasks(raw.tasks ?? []),
        };
        const rolled = rolloverIfNeeded(data);
        set({
          ...rolled,
          currentView: { kind: "my-day" },
          selectedTaskId: null,
        });
        applyThemeClass(rolled.theme);
        rescheduleAndroidReminders();
      },
    }),
    {
      name: "todo-persist",
      storage:
        getAppPersistStorage() ??
        createJSONStorage(() => {
          if (typeof window === "undefined") {
            return {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            };
          }
          return window.localStorage;
        }),
      partialize: (s) => ({
        version: s.version,
        theme: s.theme,
        hideCompleted: s.hideCompleted,
        sidebarMotto: s.sidebarMotto,
        lastCalendarDate: s.lastCalendarDate,
        listGroups: s.listGroups,
        lists: s.lists,
        tasks: s.tasks,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppStore> | undefined;
        if (!p || !p.lists?.length) {
          return { ...current, ...seed() };
        }
        const base: AppStateV1 = {
          version: 1,
          theme: p.theme ?? "system",
          hideCompleted: p.hideCompleted ?? false,
          sidebarMotto: normalizeSidebarMotto(p.sidebarMotto),
          reminderPolicy: normalizeReminderPolicy(p.reminderPolicy),
          lastCalendarDate: p.lastCalendarDate ?? todayYmd(),
          listGroups: p.listGroups ?? [],
          lists: p.lists ?? [],
          tasks: normalizeTasks(p.tasks ?? []),
        };
        const rolled = rolloverIfNeeded(base);
        return {
          ...current,
          ...rolled,
          currentView: current.currentView,
          selectedTaskId: current.selectedTaskId,
          sidebarOpen: current.sidebarOpen,
          taskPaneOpen: current.taskPaneOpen,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClass(state.theme);
        }
      },
    },
  ),
);

// 系统主题监听
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const t = useAppStore.getState().theme;
    if (t === "system") applyThemeClass("system");
  });

  document.addEventListener("todo-external-mutate", () => {
    void useAppStore.getState().reloadFromDisk();
  });
}

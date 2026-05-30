import { useMemo, useEffect, useState, type CSSProperties } from "react";
import { useAppStore } from "../store/appStore";
import {
  filterTasksForView,
  groupPlannedTasks,
  sortMyDaySuggestions,
  sortTasksByOrder,
} from "../lib/smartFilters";
import { viewLabel } from "../lib/labels";
import { filterTasksBySearch } from "../lib/taskSearch";
import type { List } from "../types";
import { TaskRow } from "./TaskRow";
import { AddTaskBar } from "./AddTaskBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { isMobileUi } from "../lib/platform";
import {
  openTaskDetail,
  registerBackHandler,
  setListSelectionActive,
} from "../lib/appNavigation";
import { rescheduleAndroidReminders } from "../lib/androidReminders";

function listBackgroundStyle(list: List | undefined): CSSProperties {
  if (!list) return {};
  const { type, value } = list.background;
  if (type === "solid" && value) {
    return {
      background: `linear-gradient(180deg, ${value}55 0%, rgb(var(--surface)) 38%)`,
    };
  }
  if (type === "image" && value) {
    return {
      backgroundImage: `linear-gradient(180deg,rgba(0,0,0,0.35),rgb(var(--surface))), url(${value})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
    };
  }
  return {};
}

export function ListPane() {
  const {
    tasks,
    lists,
    currentView,
    hideCompleted,
    selectedTaskId,
    toggleTaskComplete,
    toggleMyDay,
    deleteTask,
    setHideCompleted,
    setCurrentView,
    moveTasksToList,
    reorderTasksInView,
    sidebarOpen,
    searchQuery,
  } = useAppStore();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const currentList =
    currentView.kind === "list"
      ? lists.find((l) => l.id === currentView.listId)
      : undefined;

  const isSearching = searchQuery.trim().length > 0;

  const isPlannedAll =
    !isSearching &&
    currentView.kind === "planned" &&
    currentView.bucket === "all";

  const plannedSections = useMemo(() => {
    if (!isPlannedAll) return null;
    let all = filterTasksForView(
      tasks,
      { kind: "planned", bucket: "all" },
      { hideCompleted: false },
    );
    if (hideCompleted) all = all.filter((t) => !t.completed);
    return groupPlannedTasks(all);
  }, [tasks, isPlannedAll, hideCompleted]);

  const { incomplete, completed } = useMemo(() => {
    if (isSearching) {
      let all = filterTasksBySearch(tasks, searchQuery);
      all = sortTasksByOrder(all);
      if (hideCompleted) {
        return {
          incomplete: all.filter((t) => !t.completed),
          completed: [] as typeof all,
        };
      }
      return {
        incomplete: all.filter((t) => !t.completed),
        completed: all.filter((t) => t.completed),
      };
    }
    if (isPlannedAll) {
      return { incomplete: [] as typeof tasks, completed: [] as typeof tasks };
    }
    let all = filterTasksForView(tasks, currentView, { hideCompleted: false });
    if (currentView.kind === "my-day") {
      all = sortMyDaySuggestions(all);
    } else {
      all = sortTasksByOrder(all);
    }
    if (hideCompleted) {
      return { incomplete: all.filter((t) => !t.completed), completed: [] as typeof all };
    }
    return {
      incomplete: all.filter((t) => !t.completed),
      completed: all.filter((t) => t.completed),
    };
  }, [tasks, currentView, hideCompleted, isPlannedAll, isSearching, searchQuery]);

  const title = isSearching
    ? `搜索${searchQuery.trim() ? ` · ${searchQuery.trim()}` : ""}`
    : viewLabel(currentView, lists);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    setListSelectionActive(selectionMode);
    return () => setListSelectionActive(false);
  }, [selectionMode]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const pick = prompt(
      `目标列表名称：\n${lists.map((l) => l.name).join("、")}`,
      lists[0]?.name ?? "",
    );
    if (!pick?.trim()) return;
    const list = lists.find((l) => l.name === pick.trim());
    if (!list) {
      alert("未找到该列表");
      return;
    }
    const listId = list.id;
    moveTasksToList(ids, listId);
    exitSelection();
  };

  const nudgeOrder = (taskId: string, dir: -1 | 1) => {
    const ordered = [...incomplete, ...completed].map((t) => t.id);
    const i = ordered.indexOf(taskId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j], next[i]];
    reorderTasksInView(next);
  };

  useEffect(() => {
    return registerBackHandler(() => {
      if (selectionMode) {
        exitSelection();
        return true;
      }
      return false;
    });
  }, [selectionMode]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        document.getElementById("todo-add-task")?.focus();
      }
      if (mod && e.key.toLowerCase() === "d" && selectedTaskId) {
        e.preventDefault();
        toggleTaskComplete(selectedTaskId);
      }
      if (e.key === "Escape" && selectionMode) exitSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTaskId, toggleTaskComplete, selectionMode]);

  const plannedBuckets = [
    { kind: "planned", bucket: "all" },
    { kind: "planned", bucket: "overdue" },
    { kind: "planned", bucket: "today" },
    { kind: "planned", bucket: "tomorrow" },
    { kind: "planned", bucket: "later" },
  ] as const;

  const renderTask = (t: (typeof incomplete)[0]) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={t.id === selectedTaskId}
      selectionMode={selectionMode}
      checked={selectedIds.has(t.id)}
      onToggleSelect={() => toggleSelect(t.id)}
      onOpen={() => openTaskDetail(t.id)}
      onToggleComplete={() => {
        toggleTaskComplete(t.id);
        rescheduleAndroidReminders();
      }}
      onSwipeRight={() => toggleMyDay(t.id)}
      onDeletePress={() =>
        setDeleteTarget({
          id: t.id,
          title: t.title.trim() || "（无标题）",
        })
      }
      onLongPress={() => {
        setSelectionMode(true);
        setSelectedIds(new Set([t.id]));
      }}
    />
  );

  return (
    <main
      className={`flex min-h-0 min-w-0 flex-1 flex-col border-r border-border bg-surface ${
        sidebarOpen && isMobileUi() ? "max-md:pointer-events-none" : ""
      }`}
      style={listBackgroundStyle(currentList)}
      aria-label="任务列表"
    >
      <header className="no-print shrink-0 border-b border-border/60 bg-elevated/80 px-4 py-2 backdrop-blur-sm">
        {selectionMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">已选 {selectedIds.size} 项</span>
            <button
              type="button"
              className="rounded-md bg-[rgb(var(--accent))] px-2 py-1 text-xs text-white"
              onClick={moveSelected}
            >
              移动到…
            </button>
            {selectedIds.size === 1 && (
              <>
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  onClick={() => nudgeOrder([...selectedIds][0], -1)}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  onClick={() => nudgeOrder([...selectedIds][0], 1)}
                >
                  下移
                </button>
              </>
            )}
            <button
              type="button"
              className="ml-auto rounded-md px-2 py-1 text-xs text-muted"
              onClick={exitSelection}
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              隐藏已完成
            </label>
          </div>
        )}
        {currentView.kind === "planned" && !selectionMode && !isSearching && (
          <div className="mt-2 flex flex-wrap gap-1">
            {plannedBuckets.map((v) => (
              <button
                key={v.bucket}
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs ${
                  JSON.stringify(currentView) === JSON.stringify(v)
                    ? "bg-[rgb(var(--accent))] text-white"
                    : "bg-black/5 dark:bg-white/10"
                }`}
                onClick={() => setCurrentView(v)}
              >
                {v.bucket === "all"
                  ? "全部"
                  : v.bucket === "overdue"
                    ? "已逾期"
                    : v.bucket === "today"
                      ? "今天"
                      : v.bucket === "tomorrow"
                        ? "明天"
                        : "以后"}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div role="list" className="flex flex-col gap-1.5">
          {isPlannedAll && plannedSections && plannedSections.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted">
              计划内暂无带截止日期的任务。在下方添加会自动设为今天到期。
            </p>
          )}
          {isPlannedAll && plannedSections
            ? plannedSections.map((section) => (
                <div key={section.bucket} className="mb-3">
                  <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {section.label}
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {section.tasks.map(renderTask)}
                  </div>
                </div>
              ))
            : null}
          {!isPlannedAll &&
            incomplete.length === 0 &&
            completed.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted">
                {isSearching
                  ? "没有匹配的任务"
                  : `暂无任务。在下方添加${!isMobileUi() ? "，或使用 Ctrl+N / Cmd+N" : ""}。`}
              </p>
            )}
          {!isPlannedAll && incomplete.map(renderTask)}
          {completed.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="mb-1 flex w-full items-center gap-1 px-1 text-xs font-medium text-muted"
                onClick={() => setCompletedCollapsed((c) => !c)}
              >
                <span>{completedCollapsed ? "▸" : "▾"}</span>
                已完成 ({completed.length})
              </button>
              {!completedCollapsed && (
                <div className="flex flex-col gap-1.5 opacity-80">
                  {completed.map(renderTask)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AddTaskBar />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除任务？"
        description={
          deleteTarget
            ? `将删除「${deleteTarget.title}」，此操作无法撤销。`
            : undefined
        }
        confirmText="删除"
        variant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
        }}
      />
    </main>
  );
}

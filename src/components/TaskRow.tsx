import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { Task } from "../types";
import { isMobileUi } from "../lib/platform";

const SWIPE_THRESHOLD = 72;
const SWIPE_ARM_DELTA = 12;
const DELETE_PANEL_WIDTH = 96;
/** 开始露出底色提示的最小水平位移 */
const HINT_SHOW_PX = 8;

type Props = {
  task: Task;
  selected: boolean;
  selectionMode: boolean;
  checked: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onToggleComplete: () => void;
  onSwipeRight: () => void;
  /** 左滑露出删除按钮后，用户点击「删除」时触发 */
  onDeletePress: () => void;
  onLongPress: () => void;
};

export function TaskRow({
  task,
  selected,
  selectionMode,
  checked,
  onToggleSelect,
  onOpen,
  onToggleComplete,
  onSwipeRight,
  onDeletePress,
  onLongPress,
}: Props) {
  const mobile = isMobileUi();
  const [offsetX, setOffsetX] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeArmed = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const swipeEnabled = mobile && !selectionMode;

  const done = task.completed;
  const stepsDone = task.steps.filter((s) => s.completed).length;
  const stepsTotal = task.steps.length;

  /** 仅在实际左滑/右滑时渲染对应底色，静止时 DOM 中不出现红色删除条 */
  const showMyDayHint = swipeEnabled && offsetX > HINT_SHOW_PX;
  const deleteRevealed = swipeEnabled && offsetX <= -SWIPE_THRESHOLD;
  const showDeleteHint = swipeEnabled && offsetX < -HINT_SHOW_PX;

  useEffect(() => {
    offsetRef.current = 0;
    setOffsetX(0);
    swipeArmed.current = false;
  }, [task.id]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const resetSwipe = () => {
    offsetRef.current = 0;
    setOffsetX(0);
    swipeArmed.current = false;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!swipeEnabled) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swipeArmed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      resetSwipe();
      onLongPress();
    }, 500);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!swipeEnabled || !touchStart.current) return;
    clearLongPress();
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) < SWIPE_ARM_DELTA && Math.abs(dy) < SWIPE_ARM_DELTA) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      resetSwipe();
      return;
    }
    swipeArmed.current = true;
    const clamped = Math.max(-120, Math.min(120, dx));
    offsetRef.current = clamped;
    setOffsetX(clamped);
  };

  const onTouchEnd = () => {
    clearLongPress();
    if (!swipeEnabled) return;
    const dx = offsetRef.current;
    if (swipeArmed.current && dx > SWIPE_THRESHOLD) {
      onSwipeRight();
      setFlash("已加入我的一天");
      window.setTimeout(() => setFlash(null), 1200);
    } else if (swipeArmed.current && dx < -SWIPE_THRESHOLD) {
      offsetRef.current = -DELETE_PANEL_WIDTH;
      setOffsetX(-DELETE_PANEL_WIDTH);
      touchStart.current = null;
      return;
    }
    resetSwipe();
    touchStart.current = null;
  };

  const rowClick = () => {
    if (deleteRevealed) {
      resetSwipe();
      return;
    }
    if (selectionMode) {
      onToggleSelect();
      return;
    }
    onOpen();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {showMyDayHint && (
        <div
          className="absolute inset-y-0 left-0 z-0 flex w-24 items-center justify-start bg-[rgb(var(--accent))] pl-3 text-xs text-white"
          aria-hidden
        >
          我的一天
        </div>
      )}
      {showDeleteHint && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-[5] flex w-24 items-center justify-center bg-red-600 text-sm font-medium text-white"
          aria-label="删除任务"
          onClick={(e) => {
            e.stopPropagation();
            resetSwipe();
            onDeletePress();
          }}
        >
          删除
        </button>
      )}
      <div
        role="listitem"
        className={`relative z-10 flex w-full min-w-0 cursor-pointer touch-pan-y items-start gap-3 border px-3 py-2.5 text-left transition ${
          selected
            ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]"
            : "border-border bg-elevated shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
        } ${done ? "opacity-70" : ""} ${checked ? "ring-2 ring-[rgb(var(--accent)/0.5)]" : ""}`}
        style={
          swipeEnabled && offsetX !== 0
            ? { transform: `translateX(${offsetX}px)` }
            : undefined
        }
        onClick={rowClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            rowClick();
          }
        }}
        tabIndex={0}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={checked}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="选择任务"
          />
        ) : (
          <button
            type="button"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted hover:border-[rgb(var(--accent))]"
            onClick={(ev) => {
              ev.stopPropagation();
              onToggleComplete();
            }}
            aria-pressed={done}
            aria-label={done ? "标记为未完成" : "标记为完成"}
          >
            {done ? (
              <span className="text-[rgb(var(--accent))]">✓</span>
            ) : null}
          </button>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${done ? "line-through" : ""}`}>
            {task.title || "（无标题）"}
          </span>
          {(task.dueDate || task.reminderAt || stepsTotal > 0) && (
            <span className="mt-0.5 block text-xs text-muted">
              {task.dueDate && (
                <>
                  截止 {task.dueDate}
                </>
              )}
              {task.reminderAt && (
                <>
                  {task.dueDate ? " · " : ""}
                  <span className="text-[rgb(var(--accent)/0.9)]">提醒</span>
                </>
              )}
              {(task.dueDate || task.reminderAt) && stepsTotal > 0 && " · "}
              {stepsTotal > 0 && (
                <span>
                  步骤 {stepsDone}/{stepsTotal}
                </span>
              )}
            </span>
          )}
        </span>
        {task.starred && (
          <span className="shrink-0 text-amber-500" aria-label="重要">
            ★
          </span>
        )}
      </div>
      {flash && (
        <p className="px-3 py-1 text-center text-xs text-[rgb(var(--accent))]">
          {flash}
        </p>
      )}
    </div>
  );
}

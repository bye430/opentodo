import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/appStore";
import type { List, ListGroup, SmartView } from "../types";
import { IconSearch } from "./icons";
import { ListBackgroundModal } from "./ListBackgroundModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { PromptDialog } from "./PromptDialog";
import { dismissKeyboard } from "../lib/dismissKeyboard";
import { isMobileUi } from "../lib/platform";
import { DEFAULT_SIDEBAR_MOTTO } from "../lib/sidebarMotto";

function SidebarMotto() {
  const motto = useAppStore((s) => s.sidebarMotto);
  const setSidebarMotto = useAppStore((s) => s.setSidebarMotto);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(motto);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(motto);
  }, [motto, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || DEFAULT_SIDEBAR_MOTTO;
    setSidebarMotto(next);
    setDraft(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1 text-xs leading-snug text-foreground outline-none focus:ring-2 focus:ring-[rgb(var(--accent)/0.35)]"
        rows={2}
        value={draft}
        aria-label="编辑格言"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(motto);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <p
      className="cursor-text text-xs leading-snug text-muted transition-colors hover:text-foreground/80"
      title="点击编辑格言"
      onClick={() => {
        setDraft(motto);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setDraft(motto);
          setEditing(true);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {motto}
    </p>
  );
}

type SidebarPrompt =
  | { kind: "new-list" }
  | { kind: "rename-list"; listId: string; defaultValue: string }
  | null;

const navBtn =
  "w-full text-left rounded-md px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/[0.06]";

const navActive =
  "bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))] font-medium";

function sortAllLists(lists: List[], listGroups: ListGroup[]): List[] {
  const groupOrder = new Map(listGroups.map((g) => [g.id, g.sortOrder]));
  return [...lists].sort((a, b) => {
    const ga = a.groupId != null ? (groupOrder.get(a.groupId) ?? 999) : 1000;
    const gb = b.groupId != null ? (groupOrder.get(b.groupId) ?? 999) : 1000;
    if (ga !== gb) return ga - gb;
    return a.sortOrder - b.sortOrder;
  });
}

function movePeerId(ids: string[], dragId: string, targetId: string): string[] {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return [...ids];
  const arr = [...ids];
  arr.splice(from, 1);
  arr.splice(to, 0, dragId);
  return arr;
}

export function Sidebar() {
  const {
    listGroups,
    lists,
    currentView,
    setCurrentView,
    sidebarOpen,
    setSidebarOpen,
    searchQuery,
    setSearchQuery,
    reorderLists,
    renameList,
    deleteList,
    duplicateList,
    addList,
  } = useAppStore();

  const mobile = isMobileUi();

  const [sidebarPrompt, setSidebarPrompt] = useState<SidebarPrompt>(null);
  const [ctx, setCtx] = useState<{
    listId: string;
    x: number;
    y: number;
  } | null>(null);
  const [bgListId, setBgListId] = useState<string | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const go = useCallback(
    (v: SmartView) => {
      setCurrentView(v);
      setSidebarOpen(false);
    },
    [setCurrentView, setSidebarOpen],
  );

  const isActive = (v: SmartView) =>
    JSON.stringify(currentView) === JSON.stringify(v);

  const sortedLists = sortAllLists(lists, listGroups);
  const flatListIds = sortedLists.map((l) => l.id);

  useEffect(() => {
    if (!ctx) return;
    let remove: (() => void) | undefined;
    const tid = window.setTimeout(() => {
      const onDown = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el.closest("[data-sidebar-context-menu]")) return;
        setCtx(null);
      };
      document.addEventListener("mousedown", onDown);
      remove = () => document.removeEventListener("mousedown", onDown);
    }, 0);
    return () => {
      clearTimeout(tid);
      remove?.();
    };
  }, [ctx]);

  const onDropOnRow = (e: DragEvent, targetListId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("application/x-list-id");
    if (!dragId || dragId === targetListId) return;
    reorderLists(movePeerId(flatListIds, dragId, targetListId));
  };

  const onDropEnd = (e: DragEvent) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("application/x-list-id");
    if (!dragId) return;
    const rest = flatListIds.filter((id) => id !== dragId);
    reorderLists([...rest, dragId]);
  };

  const nudgeList = (listId: string, dir: -1 | 1) => {
    const i = flatListIds.indexOf(listId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= flatListIds.length) return;
    const next = [...flatListIds];
    [next[i], next[j]] = [next[j], next[i]];
    reorderLists(next);
  };

  const openListMenu = (l: List, x: number, y: number) => {
    setCtx({ listId: l.id, x, y });
  };

  const renderListRow = (l: List) => {
    const active = isActive({ kind: "list", listId: l.id });
    return (
      <div
        key={l.id}
        className={`group mb-0.5 flex items-stretch rounded-md ${
          active ? "ring-1 ring-[rgb(var(--accent)/0.4)]" : ""
        }`}
        onDragOver={
          mobile
            ? undefined
            : (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
        }
        onDrop={mobile ? undefined : (e) => onDropOnRow(e, l.id)}
        onContextMenu={
          mobile
            ? undefined
            : (e) => {
                e.preventDefault();
                e.stopPropagation();
                openListMenu(l, e.clientX, e.clientY);
              }
        }
      >
        {!mobile ? (
          <span
            draggable
            title="按住拖动排序"
            className="flex w-7 shrink-0 cursor-grab select-none items-center justify-center rounded-l-md border border-r-0 border-transparent py-2 text-xs text-muted hover:bg-black/5 hover:text-foreground active:cursor-grabbing dark:hover:bg-white/[0.06]"
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-list-id", l.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={(e) => e.stopPropagation()}
          >
            ⋮⋮
          </span>
        ) : (
          <button
            type="button"
            className="flex w-9 shrink-0 items-center justify-center py-2 text-lg text-muted"
            aria-label="列表菜单"
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              openListMenu(l, r.right, r.bottom);
            }}
          >
            ⋮
          </button>
        )}
        <button
          type="button"
          className={`min-w-0 flex-1 ${mobile ? "rounded-md" : "rounded-r-md border border-l-0 border-transparent"} py-2 pl-1 pr-2 ${navBtn} ${active ? navActive : ""}`}
          onClick={() => go({ kind: "list", listId: l.id })}
        >
          <span className="block truncate">{l.name}</span>
        </button>
      </div>
    );
  };

  const menuStyle = ctx
    ? (() => {
        const kb = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--keyboard-inset-bottom",
          ),
        );
        const kbInset = Number.isFinite(kb) && kb > 0 ? kb : 0;
        const visibleBottom =
          window.innerHeight - kbInset;
        return {
          left: Math.min(ctx.x, window.innerWidth - 200),
          top: Math.min(ctx.y, visibleBottom - 220),
        };
      })()
    : {};

  const ctxList = ctx ? lists.find((l) => l.id === ctx.listId) : undefined;

  return (
    <nav
      className={`no-print box-border flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-elevated transition-transform max-md:fixed max-md:bottom-0 max-md:left-0 max-md:top-[var(--shell-header-offset)] max-md:z-50 max-md:max-h-[calc(100%-var(--shell-header-offset))] max-md:pb-[max(env(safe-area-inset-bottom,0px),var(--keyboard-inset-bottom,0px))] max-md:shadow-xl md:relative md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "max-md:-translate-x-full"
      }`}
      aria-label="主导航"
    >
      <div className="border-b border-border px-3 py-3">
        <SidebarMotto />
        <div
          className="my-2.5 border-t border-border"
          role="separator"
          aria-hidden
        />
        <label className="relative flex items-center">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-2.5 text-muted"
          />
          <input
            type="search"
            value={searchQuery}
            placeholder="搜索任务"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-[rgb(var(--accent)/0.45)] focus:ring-2 focus:ring-[rgb(var(--accent)/0.2)]"
            aria-label="搜索任务"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              setSidebarOpen(false);
              dismissKeyboard();
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              aria-label="清除搜索"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <button
          type="button"
          className={`${navBtn} ${isActive({ kind: "my-day" }) ? navActive : ""}`}
          onClick={() => go({ kind: "my-day" })}
        >
          我的一天
        </button>
        <button
          type="button"
          className={`${navBtn} ${isActive({ kind: "important" }) ? navActive : ""}`}
          onClick={() => go({ kind: "important" })}
        >
          重要
        </button>
        <button
          type="button"
          className={`${navBtn} ${
            currentView.kind === "planned" ? navActive : ""
          }`}
          onClick={() => go({ kind: "planned", bucket: "all" })}
        >
          计划内
        </button>
        <button
          type="button"
          className={`${navBtn} ${isActive({ kind: "all" }) ? navActive : ""}`}
          onClick={() => go({ kind: "all" })}
        >
          全部
        </button>

        <div className="mt-3 border-t border-border/60 pt-3">
          {sortedLists.map((l) => renderListRow(l))}
          {!mobile && (
            <div
              className="mx-1 mt-1 h-2 rounded-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={onDropEnd}
              title="拖放到列表末尾"
            />
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-1 border-t border-border p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent)/0.08)]"
          onClick={() => setSidebarPrompt({ kind: "new-list" })}
        >
          <span className="text-lg leading-none" aria-hidden>
            +
          </span>
          新建列表
        </button>
      </div>

      {ctx &&
        createPortal(
          <ul
            data-sidebar-context-menu
            className="fixed z-[56] min-w-[10rem] rounded-lg border border-border bg-elevated py-1 shadow-xl"
            style={menuStyle}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {ctxList && (
              <>
                {mobile && (
                  <>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
                        onClick={() => {
                          nudgeList(ctxList.id, -1);
                          setCtx(null);
                        }}
                      >
                        上移
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
                        onClick={() => {
                          nudgeList(ctxList.id, 1);
                          setCtx(null);
                        }}
                      >
                        下移
                      </button>
                    </li>
                    <li className="my-1 border-t border-border" />
                  </>
                )}
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
                    onClick={() => {
                      setCtx(null);
                      setSidebarPrompt({
                        kind: "rename-list",
                        listId: ctxList.id,
                        defaultValue: ctxList.name,
                      });
                    }}
                  >
                    重命名
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
                    onClick={() => {
                      duplicateList(ctxList.id);
                      setCtx(null);
                    }}
                  >
                    复制列表
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/[0.06]"
                    onClick={() => {
                      setBgListId(ctxList.id);
                      setCtx(null);
                    }}
                  >
                    设置背景…
                  </button>
                </li>
                <li className="my-1 border-t border-border" />
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setDeleteListTarget({
                        id: ctxList.id,
                        name: ctxList.name,
                      });
                      setCtx(null);
                    }}
                  >
                    删除列表
                  </button>
                </li>
              </>
            )}
          </ul>,
          document.body,
        )}

      <ListBackgroundModal
        listId={bgListId}
        onClose={() => setBgListId(null)}
      />

      <PromptDialog
        open={sidebarPrompt?.kind === "new-list"}
        title="新建列表"
        label="列表名称"
        placeholder="例如：工作、购物"
        confirmText="创建"
        onClose={() => setSidebarPrompt(null)}
        onConfirm={(name) => addList(name)}
      />
      <ConfirmDialog
        open={deleteListTarget !== null}
        title="删除列表？"
        description={
          deleteListTarget
            ? `将删除「${deleteListTarget.name}」及其全部任务，此操作无法撤销。`
            : undefined
        }
        confirmText="删除"
        variant="danger"
        onClose={() => setDeleteListTarget(null)}
        onConfirm={() => {
          if (deleteListTarget) deleteList(deleteListTarget.id);
        }}
      />

      <PromptDialog
        open={sidebarPrompt?.kind === "rename-list"}
        title="重命名列表"
        label="列表名称"
        defaultValue={
          sidebarPrompt?.kind === "rename-list" ? sidebarPrompt.defaultValue : ""
        }
        confirmText="保存"
        onClose={() => setSidebarPrompt(null)}
        onConfirm={(name) => {
          if (sidebarPrompt?.kind === "rename-list") {
            renameList(sidebarPrompt.listId, name);
          }
        }}
      />
    </nav>
  );
}

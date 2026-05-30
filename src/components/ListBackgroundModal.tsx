import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import type { List } from "../types";
import { isAndroid } from "../lib/platform";

type Props = {
  listId: string | null;
  onClose: () => void;
};

export function ListBackgroundModal({ listId, onClose }: Props) {
  const lists = useAppStore((s) => s.lists);
  const updateListBackground = useAppStore((s) => s.updateListBackground);
  const list = listId ? lists.find((l) => l.id === listId) : undefined;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    if (!listId) return;
    const onPicked = (e: Event) => {
      const d = (e as CustomEvent<{ listId: string; url: string }>).detail;
      if (d.listId !== listId) return;
      updateListBackground(listId, { type: "image", value: d.url });
    };
    document.addEventListener("todo-background-picked", onPicked);
    return () => document.removeEventListener("todo-background-picked", onPicked);
  }, [listId, updateListBackground]);

  if (!listId || !list) return null;

  const bg = list.background;

  const setBg = (patch: Partial<List["background"]>) => {
    updateListBackground(list.id, { ...bg, ...patch });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-elevated p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bg-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bg-modal-title" className="text-base font-semibold">
          列表背景 · {list.name}
        </h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-muted">类型</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2"
              value={bg.type}
              onChange={(e) =>
                setBg({
                  type: e.target.value as List["background"]["type"],
                  value:
                    e.target.value === "none"
                      ? ""
                      : bg.value || "#3b82f6",
                })
              }
            >
              <option value="none">无</option>
              <option value="solid">纯色</option>
              <option value="image">图片 URL</option>
            </select>
          </label>
          {bg.type === "solid" && (
            <label className="block">
              <span className="text-xs text-muted">颜色</span>
              <input
                type="color"
                className="mt-1 h-10 w-full cursor-pointer rounded border border-border"
                value={bg.value?.startsWith("#") ? bg.value : "#3b82f6"}
                onChange={(e) => setBg({ type: "solid", value: e.target.value })}
              />
            </label>
          )}
          {bg.type === "image" && (
            <>
              {isAndroid() && window.todoAndroid?.pickListBackgroundImage && (
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-[rgb(var(--accent))]"
                  onClick={() => {
                    window.__todoBackgroundListId = list.id;
                    void window.todoAndroid?.pickListBackgroundImage(list.id);
                  }}
                >
                  从相册选择…
                </button>
              )}
              <label className="block">
                <span className="text-xs text-muted">图片地址</span>
                <input
                  type="url"
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2"
                  placeholder="https://…"
                  value={bg.value}
                  onChange={(e) => setBg({ type: "image", value: e.target.value })}
                />
              </label>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm text-muted hover:bg-black/5 dark:hover:bg-white/[0.06]"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

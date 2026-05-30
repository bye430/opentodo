import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PromptDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
};

const btnSecondary =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/[0.06]";
const btnPrimary =
  "rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40";

export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  confirmText = "确定",
  cancelText = "取消",
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    const tid = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 pt-4 sm:items-center sm:pb-4"
      style={{
        paddingBottom: "max(1rem, var(--keyboard-inset-bottom, 0px))",
      }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="mb-0 w-full max-w-md rounded-xl border border-border bg-elevated shadow-xl sm:mb-0 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        <div className="px-4 py-4">
          <label className="block text-xs font-medium text-muted">{label}</label>
          <input
            ref={inputRef}
            type="text"
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-[rgb(var(--accent))] focus:ring-2"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className={btnSecondary} onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!value.trim()}
            onClick={submit}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

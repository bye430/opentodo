import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onClose: () => void;
};

const btnSecondary =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/[0.06]";
const btnPrimary =
  "rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90";
const btnDanger =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:hover:bg-red-500";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  variant = "default",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-elevated p-4 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={variant === "danger" ? btnDanger : btnPrimary}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

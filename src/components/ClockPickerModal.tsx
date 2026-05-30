import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { dismissKeyboard } from "../lib/dismissKeyboard";
import { registerBackHandler } from "../lib/appNavigation";
import { ClockTimePicker } from "./ClockTimePicker";

type Props = {
  open: boolean;
  value: string;
  onChange: (hm: string) => void;
  onClose: () => void;
};

export function ClockPickerModal({ open, value, onChange, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    dismissKeyboard();
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      data-clock-picker-open
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-border/80 bg-elevated shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/60 px-4 py-3">
          <h2
            id={titleId}
            className="text-center text-sm font-semibold text-foreground"
          >
            选择时间
          </h2>
        </div>
        <div className="px-2 py-3">
          <ClockTimePicker
            value={value || "09:00"}
            onChange={onChange}
          />
        </div>
        <div className="border-t border-border/60 px-4 py-3">
          <button
            type="button"
            className="w-full rounded-xl bg-[rgb(var(--accent))] py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

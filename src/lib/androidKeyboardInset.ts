import { isAndroid } from "./platform";

/** vv 与 layout 高度差；键盘弹出时通常 > 100 */
const VV_GAP_TRUST_THRESHOLD_PX = 100;
const MAX_INSET_RATIO_OF_VIEWPORT = 0.65;

/**
 * 键盘弹出时额外上抬（CSS px）。想再往上 → 增大；贴太低 → 减小或 0。
 * 只作用于 finalInset > 0，不影响收起键盘后的底部贴边。
 */
export const KEYBOARD_INSET_TUNE_PX: number = 24;

function readNativeKeyboardInsetPx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--keyboard-inset-native",
  );
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function measureVisualViewportGap(): number {
  const vv = window.visualViewport;
  const layoutH = window.innerHeight;
  const vvH = vv?.height ?? layoutH;
  return Math.max(0, layoutH - vvH);
}

function clampInset(px: number): number {
  const max = Math.floor(window.innerHeight * MAX_INSET_RATIO_OF_VIEWPORT);
  return Math.max(0, Math.min(Math.round(px), max));
}

/** 兜底：若仍像物理像素（大于视口），按 DPR 折算 */
function normalizeNativeInset(nativeInset: number): number {
  const ih = window.innerHeight;
  if (nativeInset <= ih) return nativeInset;
  const dpr = window.devicePixelRatio;
  if (dpr > 1) {
    const scaled = Math.round(nativeInset / dpr);
    if (scaled <= ih) return scaled;
  }
  return clampInset(nativeInset);
}

function writeKeyboardInset(px: number): void {
  document.documentElement.style.setProperty(
    "--keyboard-inset-bottom",
    px > 0 ? `${px}px` : "0px",
  );
}

/**
 * 优先级：visualViewport 明确缩小时用 vv；否则用 Kotlin 已换算的 CSS 键盘高度。
 */
export function applyAndroidKeyboardInset(): void {
  const vvGap = measureVisualViewportGap();
  let nativeInset = normalizeNativeInset(readNativeKeyboardInsetPx());

  let finalInset = 0;
  let source: "vv" | "native" | "none" = "none";
  if (vvGap > VV_GAP_TRUST_THRESHOLD_PX) {
    finalInset = clampInset(vvGap);
    source = "vv";
  } else if (nativeInset > 0) {
    finalInset = clampInset(nativeInset);
    source = "native";
  }

  document.documentElement.setAttribute("data-keyboard-inset-source", source);
  if (finalInset > 0) {
    finalInset = clampInset(finalInset + KEYBOARD_INSET_TUNE_PX);
  }
  writeKeyboardInset(finalInset);
}

export function startAndroidKeyboardInsetSync(): () => void {
  if (!isAndroid()) return () => {};

  const apply = () => applyAndroidKeyboardInset();

  const vv = window.visualViewport;
  vv?.addEventListener("resize", apply);
  vv?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("todo-keyboard-inset", apply);
  window.addEventListener("focusin", apply);
  window.addEventListener("focusout", apply);

  apply();

  return () => {
    vv?.removeEventListener("resize", apply);
    vv?.removeEventListener("scroll", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("todo-keyboard-inset", apply);
    window.removeEventListener("focusin", apply);
    window.removeEventListener("focusout", apply);
  };
}

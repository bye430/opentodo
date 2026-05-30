import { useEffect, useState } from "react";

function readCssKeyboardInset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--keyboard-inset-bottom",
  );
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function measureVisualViewportInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const layoutBottom = window.innerHeight;
  const vvBottom = vv.offsetTop + vv.height;
  return Math.max(0, layoutBottom - vvBottom);
}

function measureLayoutInset(): number {
  const el = document.documentElement;
  return Math.max(0, window.innerHeight - el.clientHeight);
}

function measureKeyboardInset(): number {
  return Math.max(
    readCssKeyboardInset(),
    measureVisualViewportInset(),
    measureLayoutInset(),
  );
}

/** 键盘占用底部高度（px），供 fixed 输入条或 padding 使用 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    const update = () => setInset(measureKeyboardInset());
    update();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("todo-keyboard-inset", update);

    const id = window.setInterval(update, 100);
    const stop = window.setTimeout(() => window.clearInterval(id), 2000);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("todo-keyboard-inset", update);
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [active]);

  return inset;
}

import { applyTodoLaunch } from "./todoLaunch";

export type NotifyResult = { ok: boolean; reason?: string; error?: string };

/** Electron 主进程通知；否则使用浏览器 Notification API */
export async function showTodoNotification(
  title: string,
  body?: string,
  taskId?: string,
): Promise<NotifyResult> {
  const bridge = window.todoNotify;
  if (bridge?.show) {
    const r = await bridge.show(title, body ?? "", taskId);
    if (r.ok) return { ok: true };
    return { ok: false, error: r.error, reason: "electron" };
  }

  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return { ok: false, reason: "permission" };
    }
  }
  if (perm !== "granted") {
    return { ok: false, reason: perm === "denied" ? "denied" : "permission" };
  }

  try {
    const n = new Notification(title, {
      body: body && body.length > 0 ? body : undefined,
      silent: false,
    });
    if (taskId) {
      n.onclick = () => {
        window.focus();
        n.close();
        applyTodoLaunch({ taskId });
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "show" };
  }
}

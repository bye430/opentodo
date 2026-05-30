"use strict";

/**
 * 由 systemd 用户 timer / macOS LaunchAgent 周期性拉起：无 UI，只读数据文件、弹系统通知并写回状态。
 * 启动方式：与主程序相同的可执行文件 + 参数 --todo-reminder-tick
 */
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const { app, Notification } = require("electron");

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

const DATA_LOC_FILENAME = "data-location.json";

const DEFAULT_POLICY = {
  daysBeforeFirst: 3,
  daysBeforeSecond: 1,
  finalHoursBeforeDue: 24,
  finalIntervalHours: 2,
};

function readDataFileFromUserData(userData) {
  try {
    const raw = fs.readFileSync(path.join(userData, DATA_LOC_FILENAME), "utf8");
    const j = JSON.parse(raw);
    if (typeof j.filePath === "string" && j.filePath.length > 0) {
      return path.resolve(j.filePath);
    }
  } catch (_) {
    /* empty */
  }
  return "";
}

function listName(lists, listId) {
  const l = lists.find((x) => x.id === listId);
  return l && typeof l.name === "string" ? l.name : "";
}

function normalizePolicy(raw) {
  const d = DEFAULT_POLICY;
  const n = (v, fb, min, max) => {
    const x = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fb;
    return Math.min(max, Math.max(min, x));
  };
  return {
    daysBeforeFirst: n(raw?.daysBeforeFirst, d.daysBeforeFirst, 0, 30),
    daysBeforeSecond: n(raw?.daysBeforeSecond, d.daysBeforeSecond, 0, 30),
    finalHoursBeforeDue: n(raw?.finalHoursBeforeDue, d.finalHoursBeforeDue, 1, 168),
    finalIntervalHours: n(raw?.finalIntervalHours, d.finalIntervalHours, 1, 12),
  };
}

function taskDueMs(task) {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parts = task.dueTime?.split(":").map((x) => Number(x)) ?? [9, 0];
  const hh = parts[0] ?? 9;
  const mm = parts[1] ?? 0;
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function dueSoonSlots(task, policy) {
  const dueMs = taskDueMs(task);
  if (dueMs === null) return [];
  const msSet = new Set();
  const dayMs = 86400000;
  const hourMs = 3600000;
  if (policy.daysBeforeFirst > 0) msSet.add(dueMs - policy.daysBeforeFirst * dayMs);
  if (policy.daysBeforeSecond > 0) msSet.add(dueMs - policy.daysBeforeSecond * dayMs);
  const windowStart = dueMs - policy.finalHoursBeforeDue * hourMs;
  const step = policy.finalIntervalHours * hourMs;
  for (let t = windowStart; t < dueMs; t += step) msSet.add(t);
  msSet.add(dueMs);
  return [...msSet]
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms).toISOString());
}

function readDueSoonSlots(task) {
  if (Array.isArray(task.dueSoonNotifiedSlots)) return task.dueSoonNotifiedSlots;
  if (Array.isArray(task.reminderFiredSlots)) return task.reminderFiredSlots;
  return [];
}

app.whenReady().then(async () => {
  try {
    const userData = app.getPath("userData");
    const fp = readDataFileFromUserData(userData);
    if (!fp) {
      await app.quit();
      return;
    }
    let text;
    try {
      text = await fsp.readFile(fp, "utf8");
    } catch (err) {
      if (err && err.code === "ENOENT") {
        await app.quit();
        return;
      }
      throw err;
    }
    let envelope;
    try {
      envelope = JSON.parse(text);
    } catch (e) {
      console.error("[todo-reminder-tick] JSON parse:", e);
      await app.quit();
      return;
    }
    const state = envelope && envelope.state;
    if (!state || !Array.isArray(state.tasks)) {
      await app.quit();
      return;
    }
    const lists = Array.isArray(state.lists) ? state.lists : [];
    const policy = normalizePolicy(state.reminderPolicy);
    const now = Date.now();
    let changed = false;
    const supported = Notification.isSupported();

    for (const task of state.tasks) {
      if (task.completed) continue;

      if (!task.completed && task.dueDate) {
        const fired = readDueSoonSlots(task);
        for (const fireAt of dueSoonSlots(task, policy)) {
          const fireMs = new Date(fireAt).getTime();
          if (Number.isNaN(fireMs) || fireMs > now) continue;
          if (fired.includes(fireAt)) continue;
          if (supported) {
            try {
              const subtitle = listName(lists, task.listId);
              const n = new Notification({
                title: `临期：${task.title || "任务"}`,
                body: subtitle ? `列表：${subtitle}` : "",
              });
              n.show();
            } catch (e) {
              console.error("[todo-reminder-tick] Notification:", e);
            }
          }
          if (!fired.includes(fireAt)) fired.push(fireAt);
          task.dueSoonNotifiedSlots = fired;
          changed = true;
        }
      }

      if (!task.reminderAt) continue;
      const at = new Date(task.reminderAt).getTime();
      if (Number.isNaN(at) || now < at) continue;
      if ((task.reminderLastFiredAt ?? null) === task.reminderAt) continue;
      if (supported) {
        try {
          const subtitle = listName(lists, task.listId);
          const n = new Notification({
            title: `提醒：${task.title || "任务"}`,
            body: subtitle ? `列表：${subtitle}` : "",
          });
          n.show();
        } catch (e) {
          console.error("[todo-reminder-tick] Notification:", e);
        }
      }
      task.reminderLastFiredAt = task.reminderAt;
      changed = true;
    }
    if (changed) {
      const tmp = `${fp}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(envelope), "utf8");
      await fsp.rename(tmp, fp);
    }
  } catch (e) {
    console.error("[todo-reminder-tick]", e);
  } finally {
    await app.quit();
  }
});

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/** 渲染进程可用来区分是否在 Electron 壳内 */
contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
});

let dataFilePath = "";
try {
  dataFilePath = ipcRenderer.sendSync("todo-data:get-path-sync") || "";
} catch {
  dataFilePath = "";
}

contextBridge.exposeInMainWorld("todoData", {
  dataFilePath,
  read: () => ipcRenderer.invoke("todo-data:read"),
  write: (text) => ipcRenderer.invoke("todo-data:write", text),
  remove: () => ipcRenderer.invoke("todo-data:remove"),
  pickPath: () => ipcRenderer.invoke("todo-data:pick-path"),
  setPath: (absPath) => ipcRenderer.invoke("todo-data:set-path", absPath),
  getPath: () => ipcRenderer.invoke("todo-data:get-path"),
});

contextBridge.exposeInMainWorld("todoNotify", {
  show: (title, body, taskId) =>
    ipcRenderer.invoke("todo-notify:show", { title, body, taskId: taskId || "" }),
  onOpenTask: (handler) => {
    const listener = (_e, payload) => {
      if (payload && typeof payload.taskId === "string" && payload.taskId) {
        handler(payload.taskId);
      }
    };
    ipcRenderer.on("todo-notify:open-task", listener);
    return () => ipcRenderer.removeListener("todo-notify:open-task", listener);
  },
});

contextBridge.exposeInMainWorld("todoScheduler", {
  register: () => ipcRenderer.invoke("todo-scheduler:register"),
  unregister: () => ipcRenderer.invoke("todo-scheduler:unregister"),
  status: () => ipcRenderer.invoke("todo-scheduler:status"),
});

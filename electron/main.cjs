"use strict";

const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

const TODO_REMINDER_TICK = "--todo-reminder-tick";

/** 无 UI 的提醒 tick：由 systemd 用户 timer / LaunchAgent 拉起，不走主窗口单例逻辑 */
if (process.argv.includes(TODO_REMINDER_TICK)) {
  require("./reminderTick.cjs");
} else {
  const { app, BrowserWindow, ipcMain, dialog, Notification } = require("electron");

  /** Linux：SUID sandbox 在多数发行版未配置；须在进程 argv 生效（见 package.json build.linux.executableArgs），此处再兜底 */
  if (process.platform === "linux") {
    app.commandLine.appendSwitch("no-sandbox");
    app.commandLine.appendSwitch("disable-setuid-sandbox");
  }

  /** 与 `npm run dev:desktop` 中 Vite 端口一致（默认 5173，可用 VITE_DEV_SERVER_URL 覆盖） */
  const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
  /** 与 `npm run dev:desktop` 中环境变量一致：走 Vite 开发服务器；否则加载打包后的 `dist/` */
  const useViteDevServer = process.env.ELECTRON_DEV === "1";

  const DATA_LOC_FILENAME = "data-location.json";

  let mainWindow = null;

  function dataLocationConfigPath() {
    return path.join(app.getPath("userData"), DATA_LOC_FILENAME);
  }

  function readDataFilePathSync() {
    try {
      const raw = fs.readFileSync(dataLocationConfigPath(), "utf8");
      const j = JSON.parse(raw);
      if (typeof j.filePath === "string" && j.filePath.length > 0) {
        const abs = path.resolve(j.filePath);
        if (path.isAbsolute(abs)) return abs;
      }
    } catch (_) {
      /* 无配置或解析失败 */
    }
    return "";
  }

  function writeDataFilePathConfig(filePathOrEmpty) {
    const dir = path.dirname(dataLocationConfigPath());
    fs.mkdirSync(dir, { recursive: true });
    if (!filePathOrEmpty) {
      fs.writeFileSync(dataLocationConfigPath(), JSON.stringify({}), "utf8");
      return;
    }
    const abs = path.resolve(filePathOrEmpty);
    fs.writeFileSync(dataLocationConfigPath(), JSON.stringify({ filePath: abs }), "utf8");
  }

  function registerTodoNotifyIpc() {
    ipcMain.handle("todo-notify:show", (_e, payload) => {
      try {
        const title =
          payload && typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : "TODO";
        const body = payload && typeof payload.body === "string" ? payload.body : "";
        const taskId =
          payload && typeof payload.taskId === "string" && payload.taskId.trim()
            ? payload.taskId.trim()
            : "";
        if (!Notification.isSupported()) {
          return { ok: false, error: "系统不支持桌面通知" };
        }
        const n = new Notification({ title, body });
        n.on("click", () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            if (taskId) {
              mainWindow.webContents.send("todo-notify:open-task", { taskId });
            }
          }
        });
        n.show();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
  }

  function registerTodoSchedulerIpc() {
    const scheduler = require("./systemScheduler.cjs");
    ipcMain.handle("todo-scheduler:register", () => {
      if (process.env.ELECTRON_DEV === "1") {
        return {
          ok: false,
          error:
            "开发模式（ELECTRON_DEV=1）不会写入系统单元；请使用打包安装版或去掉该环境变量后再注册。",
        };
      }
      if (!readDataFilePathSync()) {
        return {
          ok: false,
          error:
            "请先在「数据位置」中选择磁盘数据文件。后台 tick 需直接读写该 JSON 才能更新「已提醒」状态。",
        };
      }
      try {
        return scheduler.register(process.execPath);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
    ipcMain.handle("todo-scheduler:unregister", () => {
      try {
        return scheduler.unregister();
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
    ipcMain.handle("todo-scheduler:status", () => scheduler.status());
  }

  function registerTodoDataIpc() {
    ipcMain.on("todo-data:get-path-sync", (event) => {
      try {
        event.returnValue = readDataFilePathSync();
      } catch {
        event.returnValue = "";
      }
    });

    ipcMain.handle("todo-data:read", async () => {
      const fp = readDataFilePathSync();
      if (!fp) return null;
      try {
        return await fsp.readFile(fp, "utf8");
      } catch (err) {
        if (err && err.code === "ENOENT") return null;
        throw err;
      }
    });

    ipcMain.handle("todo-data:write", async (_e, text) => {
      const fp = readDataFilePathSync();
      if (!fp) throw new Error("未配置数据文件路径");
      await fsp.mkdir(path.dirname(fp), { recursive: true });
      const tmp = `${fp}.tmp`;
      await fsp.writeFile(tmp, String(text), "utf8");
      await fsp.rename(tmp, fp);
    });

    ipcMain.handle("todo-data:remove", async () => {
      const fp = readDataFilePathSync();
      if (!fp) return;
      try {
        await fsp.unlink(fp);
      } catch (err) {
        if (err && err.code !== "ENOENT") throw err;
      }
    });

    ipcMain.handle("todo-data:get-path", async () => readDataFilePathSync());

    ipcMain.handle("todo-data:pick-path", async () => {
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      const current = readDataFilePathSync();
      const r = await dialog.showSaveDialog(win, {
        title: "选择 TODO 数据文件",
        defaultPath: current || path.join(app.getPath("documents"), "todo-data.json"),
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (r.canceled || !r.filePath) return null;
      return path.resolve(r.filePath);
    });

    ipcMain.handle("todo-data:set-path", async (_e, newPath) => {
      try {
        if (!newPath) {
          writeDataFilePathConfig("");
          return { ok: true };
        }
        const abs = path.resolve(String(newPath));
        if (!path.isAbsolute(abs)) {
          return { ok: false, error: "路径无效" };
        }
        writeDataFilePathConfig(abs);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 800,
      minHeight: 520,
      show: false,
      title: "TODO",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    if (useViteDevServer) {
      mainWindow.loadURL(DEV_URL);
    } else {
      const indexHtml = path.join(__dirname, "..", "dist", "index.html");
      mainWindow.loadFile(indexHtml).catch((err) => {
        console.error("[todo] loadFile failed:", indexHtml, err);
      });
    }

    mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
      console.error("[todo] did-fail-load", code, desc, url);
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      if (process.platform === "win32") {
        app.setAppUserModelId("com.todo.app");
      }
      registerTodoNotifyIpc();
      registerTodoSchedulerIpc();
      registerTodoDataIpc();
      createWindow();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }
}

/**
 * 在 Vite 主 bundle 之前注入，对接 Kotlin @JavascriptInterface「AndroidTodo」。
 */
(function () {
  var B = window.AndroidTodo;
  if (!B) return;

  function parseJson(s, fallback) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback;
    }
  }

  window.desktop = { isDesktop: true, platform: "android" };

  window.__todoHandleBack = function () {
    try {
      if (window.__todoHandleBackImpl) window.__todoHandleBackImpl();
    } catch (e) {
      /* ignore */
    }
  };

  window.todoData = {
    dataFilePath: B.getDataFilePath() || "",
    read: function () {
      return Promise.resolve().then(function () {
        var s = B.readData();
        return s && s.length > 0 ? s : null;
      });
    },
    write: function (text) {
      return Promise.resolve().then(function () {
        B.writeData(text);
        if (window.todoReminders && window.todoReminders.reschedule) {
          window.todoReminders.reschedule();
        }
      });
    },
    remove: function () {
      return Promise.resolve().then(function () {
        B.removeData();
      });
    },
    pickPath: function () {
      B.pickDataFilePath();
      return Promise.resolve(null);
    },
    setPath: function (absPath) {
      return Promise.resolve().then(function () {
        var r = parseJson(B.setDataFilePath(absPath || ""), { ok: false });
        if (r.ok && window.todoReminders && window.todoReminders.reschedule) {
          window.todoReminders.reschedule();
        }
        return r;
      });
    },
    getPath: function () {
      return Promise.resolve(B.getDataFilePath() || "");
    },
  };

  window.todoNotify = {
    show: function (title, body, taskId) {
      return Promise.resolve().then(function () {
        return parseJson(
          B.showNotification(title, body || "", taskId || ""),
          { ok: false },
        );
      });
    },
  };

  window.todoReminders = {
    reschedule: function () {
      return Promise.resolve().then(function () {
        return parseJson(B.rescheduleReminders(), { ok: false });
      });
    },
  };

  window.todoAndroid = {
    openNotificationSettings: function () {
      return Promise.resolve().then(function () {
        return parseJson(B.openNotificationSettings(), { ok: false });
      });
    },
    openBatterySettings: function () {
      return Promise.resolve().then(function () {
        return parseJson(B.openBatterySettings(), { ok: false });
      });
    },
    pickListBackgroundImage: function (listId) {
      return Promise.resolve().then(function () {
        return parseJson(B.pickListBackgroundImage(listId), { ok: false });
      });
    },
  };

  window.__todoOnBackgroundPicked = function (resultJson) {
    var r = typeof resultJson === "string" ? parseJson(resultJson, {}) : resultJson;
    if (r.ok && r.url && window.__todoBackgroundListId) {
      document.dispatchEvent(
        new CustomEvent("todo-background-picked", {
          detail: { listId: window.__todoBackgroundListId, url: r.url },
        }),
      );
    }
    window.__todoBackgroundListId = null;
  };

  window.__todoReloadFromDisk = function () {
    document.dispatchEvent(new CustomEvent("todo-external-mutate"));
  };
})();

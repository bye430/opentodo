package com.todo.app.bridge

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.todo.app.MainActivity
import com.todo.app.data.TodoDataStore
import com.todo.app.notify.TodoNotifier
import com.todo.app.reminder.ReminderScheduler
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class TodoJsBridge(
    private val host: MainActivity,
    private val dataStore: TodoDataStore,
    private val notifier: TodoNotifier,
    private val onPickDataFile: () -> Unit,
) {
    @JavascriptInterface
    fun setBackIntercept(intercept: Boolean) {
        host.runOnUiThread { host.setWebBackIntercept(intercept) }
    }

    @JavascriptInterface
    fun getDataFilePath(): String = dataStore.getDisplayPath()

    @JavascriptInterface
    fun readData(): String = dataStore.readText() ?: ""

    @JavascriptInterface
    fun writeData(text: String) {
        dataStore.writeText(text)
    }

    @JavascriptInterface
    fun removeData() {
        dataStore.removeText()
    }

    @JavascriptInterface
    fun pickDataFilePath() {
        onPickDataFile()
    }

    @JavascriptInterface
    fun setDataFilePath(pathOrEmpty: String): String {
        val result = dataStore.setPathResult(pathOrEmpty.ifBlank { null })
        if (result.optBoolean("ok")) {
            ReminderScheduler(host).rescheduleAll()
        }
        return result.toString()
    }

    @JavascriptInterface
    fun showNotification(title: String, body: String, taskId: String): String {
        val id = taskId.trim().ifBlank { null }
        return notifier.show(title, body, id).toString()
    }

    @JavascriptInterface
    fun rescheduleReminders(): String {
        return try {
            val n = ReminderScheduler(host).rescheduleAll()
            JSONObject().put("ok", true).put("count", n).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "schedule failed").toString()
        }
    }

    @JavascriptInterface
    fun openNotificationSettings(): String {
        return try {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, host.packageName)
            }
            host.startActivity(intent)
            JSONObject().put("ok", true).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).toString()
        }
    }

    @JavascriptInterface
    fun openBatterySettings(): String {
        return try {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            host.startActivity(intent)
            JSONObject().put("ok", true).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).toString()
        }
    }

    @JavascriptInterface
    fun pickListBackgroundImage(listId: String): String {
        host.requestPickBackground(listId)
        return JSONObject().put("ok", true).put("pending", true).toString()
    }

    /** 由 MainActivity 在选图完成后调用 */
    fun completeBackgroundPick(listId: String, uri: Uri): String {
        return try {
            val dir = File(host.filesDir, "backgrounds").apply { mkdirs() }
            val out = File(dir, "$listId.jpg")
            host.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(out).use { output -> input.copyTo(output) }
            } ?: return JSONObject().put("ok", false).put("error", "无法读取图片").toString()
            val url = "https://appassets.androidplatform.net/local/backgrounds/$listId.jpg"
            JSONObject().put("ok", true).put("url", url).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "保存失败").toString()
        }
    }
}

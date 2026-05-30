package com.todo.app.data

import android.content.Context
import android.net.Uri
import androidx.core.content.edit
import org.json.JSONObject
import java.io.File

/**
 * 与 Electron `data-location.json` 类似：默认应用私有目录 JSON；
 * 用户可通过 SAF 选择外部文件（存 content URI）。
 */
class TodoDataStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val defaultFile: File
        get() = File(appContext.filesDir, DEFAULT_FILENAME)

    fun getDisplayPath(): String {
        val custom = prefs.getString(KEY_CUSTOM_URI, null)
        if (!custom.isNullOrBlank()) {
            return custom
        }
        return defaultFile.absolutePath
    }

    fun readText(): String? {
        val custom = prefs.getString(KEY_CUSTOM_URI, null)
        if (!custom.isNullOrBlank()) {
            return readFromUri(Uri.parse(custom))
        }
        val f = defaultFile
        if (!f.isFile) return null
        return f.readText(Charsets.UTF_8)
    }

    fun writeText(text: String) {
        val custom = prefs.getString(KEY_CUSTOM_URI, null)
        if (!custom.isNullOrBlank()) {
            writeToUri(Uri.parse(custom), text)
            return
        }
        val f = defaultFile
        f.parentFile?.mkdirs()
        f.writeText(text, Charsets.UTF_8)
    }

    fun removeText() {
        val custom = prefs.getString(KEY_CUSTOM_URI, null)
        if (!custom.isNullOrBlank()) {
            writeToUri(Uri.parse(custom), "")
            return
        }
        if (defaultFile.isFile) {
            defaultFile.delete()
        }
    }

    fun setCustomUri(uri: Uri?) {
        prefs.edit {
            if (uri == null) {
                remove(KEY_CUSTOM_URI)
            } else {
                putString(KEY_CUSTOM_URI, uri.toString())
            }
        }
    }

    fun clearCustomUri() {
        setCustomUri(null)
    }

    fun setPathResult(pathOrNull: String?): JSONObject {
        return try {
            when {
                pathOrNull.isNullOrBlank() -> {
                    clearCustomUri()
                    JSONObject().put("ok", true)
                }
                pathOrNull.startsWith("content://") -> {
                    setCustomUri(Uri.parse(pathOrNull))
                    JSONObject().put("ok", true)
                }
                else -> {
                    val f = File(pathOrNull)
                    if (!f.isAbsolute) {
                        JSONObject().put("ok", false).put("error", "路径无效")
                    } else {
                        f.parentFile?.mkdirs()
                        if (!f.exists()) {
                            f.writeText("", Charsets.UTF_8)
                        }
                        clearCustomUri()
                        JSONObject().put("ok", true)
                    }
                }
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "setPath 失败")
        }
    }

    private fun readFromUri(uri: Uri): String? {
        val cr = appContext.contentResolver
        cr.openInputStream(uri)?.use { input ->
            return input.bufferedReader(Charsets.UTF_8).readText().ifEmpty { null }
        }
        return null
    }

    private fun writeToUri(uri: Uri, text: String) {
        val cr = appContext.contentResolver
        cr.openOutputStream(uri, "wt")?.use { out ->
            out.write(text.toByteArray(Charsets.UTF_8))
        } ?: throw IllegalStateException("无法写入所选文件")
    }

    companion object {
        private const val PREFS_NAME = "todo_data_store"
        private const val KEY_CUSTOM_URI = "custom_data_uri"
        private const val DEFAULT_FILENAME = "todo-data.json"
    }
}

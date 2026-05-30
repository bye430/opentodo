package com.todo.app.web

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream

/** 将 `https://appassets.androidplatform.net/local/...` 映射到 `context.filesDir` */
class LocalFilesPathHandler(context: Context) : WebViewAssetLoader.PathHandler {
    private val baseDir: File = context.filesDir

    override fun handle(path: String): WebResourceResponse? {
        val rel = path.removePrefix("/").replace("..", "")
        val file = File(baseDir, rel)
        if (!file.isFile) return null
        val mime = when (file.extension.lowercase()) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "svg" -> "image/svg+xml"
            else -> "application/octet-stream"
        }
        return WebResourceResponse(mime, null, FileInputStream(file))
    }
}

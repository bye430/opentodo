package com.todo.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.todo.app.bridge.TodoJsBridge
import com.todo.app.data.TodoDataStore
import com.todo.app.notify.QuickAddNotifier
import com.todo.app.notify.TodoNotifier
import com.todo.app.reminder.ReminderScheduler
import com.todo.app.web.LocalFilesPathHandler
import kotlin.math.roundToInt
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var dataStore: TodoDataStore
    private lateinit var notifier: TodoNotifier
    private lateinit var jsBridge: TodoJsBridge

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var pendingBackgroundListId: String? = null

    private lateinit var webBackCallback: OnBackPressedCallback
    private lateinit var exitBackCallback: OnBackPressedCallback

    private val dataMutatedReceiver =
        object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context?, intent: Intent?) {
                if (intent?.action != "com.todo.app.ACTION_DATA_MUTATED") return
                if (::webView.isInitialized) {
                    webView.evaluateJavascript(
                        "window.__todoReloadFromDisk && window.__todoReloadFromDisk();",
                        null,
                    )
                }
            }
        }

    private val pickDataFile =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
                dataStore.setCustomUri(uri)
                syncDataPathToJs()
                ReminderScheduler(this@MainActivity).rescheduleAll()
            }
        }

    private val pickUploadFile =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            val cb = fileUploadCallback
            fileUploadCallback = null
            if (uri != null && cb != null) {
                cb.onReceiveValue(arrayOf(uri))
            } else {
                cb?.onReceiveValue(null)
            }
        }

    private val pickBackgroundImage =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            val listId = pendingBackgroundListId
            pendingBackgroundListId = null
            if (uri != null && listId != null) {
                val result = jsBridge.completeBackgroundPick(listId, uri)
                webView.evaluateJavascript(
                    "window.__todoOnBackgroundPicked && window.__todoOnBackgroundPicked(${org.json.JSONObject.quote(result)});",
                    null,
                )
            }
        }

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        dataStore = TodoDataStore(this)
        notifier = TodoNotifier(this)

        webView = WebView(this)
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        setContentView(webView)
        applyWindowInsets()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/local/", LocalFilesPathHandler(this))
            .build()

        jsBridge = TodoJsBridge(this, dataStore, notifier) {
            pickDataFile.launch(arrayOf("application/json", "text/*", "*/*"))
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.addJavascriptInterface(jsBridge, "AndroidTodo")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ) = assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return !url.startsWith("https://appassets.androidplatform.net/")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.clearHistory()
                ViewCompat.requestApplyInsets(webView)
                injectLaunchParams()
                ReminderScheduler(this@MainActivity).rescheduleAll()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                pickUploadFile.launch("image/*")
                return true
            }
        }

        webBackCallback =
            object : OnBackPressedCallback(false) {
                override fun handleOnBackPressed() {
                    dispatchWebBackToJs()
                }
            }
        exitBackCallback =
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            }
        onBackPressedDispatcher.addCallback(this, webBackCallback)
        onBackPressedDispatcher.addCallback(this, exitBackCallback)

        QuickAddNotifier.show(this)

        if (savedInstanceState == null) {
            webView.loadUrl(APP_ENTRY_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }

        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    fun requestPickBackground(listId: String) {
        pendingBackgroundListId = listId
        pickBackgroundImage.launch("image/*")
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val launchScript = buildLaunchScript(intent)
        if (launchScript != null) {
            webView.evaluateJavascript(launchScript, null)
        }
    }

    private fun injectLaunchParams() {
        handleIntent(intent)
    }

    private fun buildLaunchScript(intent: Intent): String? {
        val obj = JSONObject()
        when (intent.action) {
            QuickAddNotifier.ACTION_QUICK_ADD -> {
                obj.put("focusAdd", true)
            }
        }
        intent.getStringExtra(EXTRA_VIEW)?.let { obj.put("view", it) }
        intent.getStringExtra(EXTRA_TASK_ID)?.let { obj.put("taskId", it) }
        if (intent.getBooleanExtra(EXTRA_FOCUS_ADD, false)) {
            obj.put("focusAdd", true)
        }
        if (obj.length() == 0) return null
        val json = obj.toString().replace("\\", "\\\\").replace("'", "\\'")
        return "(function(){var p=$json;if(window.__todoApplyLaunch){window.__todoApplyLaunch(p);}else{window.todoLaunch=p;}})();"
    }

    private fun applyWindowInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val density = v.resources.displayMetrics.density
            val status = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            val nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imePhysical =
                if (ime.bottom > 0) maxOf(0, ime.bottom - nav.bottom) else 0
            val keyboardInsetCss = physicalPxToCssPx(imePhysical, density)
            val statusTopCss = physicalPxToCssPx(status.top, density).coerceIn(0, 48)
            applySafeAreaCss(statusTopCss, keyboardInsetCss)
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(webView)
    }

    /** WindowInsets 为物理像素；WebView/CSS 使用 dp（≈ 物理 / density） */
    private fun physicalPxToCssPx(physicalPx: Int, density: Float): Int {
        if (physicalPx <= 0 || density <= 0f) return 0
        return (physicalPx / density).roundToInt()
    }

    /** 仅注入 CSS 变量；不在 WebView 上 setPadding，避免与 100% 文档流双轨冲突 */
    private fun applySafeAreaCss(statusBarTopCssPx: Int, keyboardBottomCssPx: Int = 0) {
        val top = statusBarTopCssPx.coerceAtLeast(0)
        val kb = keyboardBottomCssPx.coerceAtLeast(0)
        webView.evaluateJavascript(
            "document.documentElement.classList.add('platform-android');" +
                "document.documentElement.style.setProperty('--safe-area-top','${top}px');" +
                "document.documentElement.style.setProperty('--keyboard-inset-native','${kb}px');" +
                "window.dispatchEvent(new CustomEvent('todo-keyboard-inset',{detail:{bottom:${kb}}}));",
            null,
        )
    }

    /** Web 在打开侧栏/详情等时调用，事前声明是否拦截系统返回（兼容预测性返回） */
    fun setWebBackIntercept(intercept: Boolean) {
        if (!::webBackCallback.isInitialized) return
        webBackCallback.isEnabled = intercept
        exitBackCallback.isEnabled = !intercept
    }

    private fun dispatchWebBackToJs() {
        webView.evaluateJavascript(
            "(function(){try{window.__todoHandleBack&&window.__todoHandleBack();}catch(e){}})();",
            null,
        )
    }

    private fun syncDataPathToJs() {
        val path = dataStore.getDisplayPath().replace("\\", "\\\\").replace("'", "\\'")
        webView.evaluateJavascript(
            "if(window.todoData){window.todoData.dataFilePath='$path';}",
            null,
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onStart() {
        super.onStart()
        LocalBroadcastManager.getInstance(this).registerReceiver(
            dataMutatedReceiver,
            android.content.IntentFilter("com.todo.app.ACTION_DATA_MUTATED"),
        )
    }

    override fun onStop() {
        LocalBroadcastManager.getInstance(this).unregisterReceiver(dataMutatedReceiver)
        super.onStop()
    }

    companion object {
        const val APP_ENTRY_URL =
            "https://appassets.androidplatform.net/assets/www/index.html"
        const val EXTRA_VIEW = "todo_view"
        const val EXTRA_TASK_ID = "todo_task_id"
        const val EXTRA_FOCUS_ADD = "todo_focus_add"
    }
}

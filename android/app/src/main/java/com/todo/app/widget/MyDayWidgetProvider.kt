package com.todo.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.todo.app.MainActivity
import com.todo.app.R
import com.todo.app.data.TodoDataStore
import com.todo.app.data.TodoPersistJson
import java.time.LocalDate
import java.time.format.DateTimeFormatter

class MyDayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val raw = TodoDataStore(context).readText()
        val tasks = TodoPersistJson.parseMyDayTasks(raw, today, 6)
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_my_day)
            views.setTextViewText(R.id.widget_title, "我的一天")
            val lines = if (tasks.isEmpty()) {
                "暂无任务"
            } else {
                tasks.joinToString("\n") { (_, title) ->
                    if (title.length > 24) title.take(24) + "…" else title
                }
            }
            views.setTextViewText(R.id.widget_tasks, lines)
            val open = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(MainActivity.EXTRA_VIEW, "my-day")
            }
            val pi = PendingIntent.getActivity(
                context,
                0,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pi)
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE ||
            intent.action == Intent.ACTION_BOOT_COMPLETED
        ) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(
                android.content.ComponentName(context, MyDayWidgetProvider::class.java),
            )
            if (ids.isNotEmpty()) onUpdate(context, mgr, ids)
        }
    }
}

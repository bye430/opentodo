package com.todo.app.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.todo.app.MainActivity
import com.todo.app.R
import org.json.JSONObject

class TodoNotifier(private val context: Context) {
    private val nm = NotificationManagerCompat.from(context)

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_reminders),
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            context.getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    fun show(title: String, body: String, taskId: String? = null): JSONObject {
        return try {
            if (!nm.areNotificationsEnabled()) {
                return JSONObject()
                    .put("ok", false)
                    .put("error", "通知未开启，请在系统设置中允许 TODO 发送通知")
            }
            val launch = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (!taskId.isNullOrBlank()) {
                    putExtra(MainActivity.EXTRA_TASK_ID, taskId)
                }
            }
            val reqCode = taskId?.hashCode() ?: 0
            val pending = PendingIntent.getActivity(
                context,
                reqCode,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title.ifBlank { "TODO" })
                .setContentText(body)
                .setStyle(
                    NotificationCompat.BigTextStyle().bigText(body).setBigContentTitle(title),
                )
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()
            nm.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
            JSONObject().put("ok", true)
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "通知失败")
        }
    }

    companion object {
        const val CHANNEL_ID = "todo_reminders"
    }
}

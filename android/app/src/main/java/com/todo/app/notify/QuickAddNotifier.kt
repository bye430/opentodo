package com.todo.app.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.todo.app.MainActivity
import com.todo.app.R

object QuickAddNotifier {
    const val CHANNEL_ID = "todo_quick_add"
    const val NOTIFICATION_ID = 9001
    const val ACTION_QUICK_ADD = "com.todo.app.QUICK_ADD"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "快速添加",
                NotificationManager.IMPORTANCE_LOW,
            )
            context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }

    fun show(context: Context) {
        ensureChannel(context)
        val open = Intent(context, MainActivity::class.java).apply {
            action = ACTION_QUICK_ADD
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("TODO")
            .setContentText("点击快速添加任务")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        androidx.core.app.NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, n)
    }
}

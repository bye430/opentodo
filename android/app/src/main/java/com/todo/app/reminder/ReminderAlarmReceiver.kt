package com.todo.app.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.todo.app.data.DueSoonNotifyAdvance
import com.todo.app.data.TaskReminderAdvance
import com.todo.app.data.TodoDataStore
import com.todo.app.data.TodoPersistJson
import com.todo.app.data.TodoTaskReminder
import com.todo.app.notify.TodoNotifier
import kotlin.math.max
import kotlin.math.roundToLong

class ReminderAlarmReceiver : BroadcastReceiver() {
    private fun formatDueSoonTitle(task: TodoTaskReminder, fireAt: String): String {
        val title = task.title.ifBlank { "任务" }
        val dueMs = AutoReminderPlanner.taskDueMs(task) ?: return "临期：$title"
        val fireMs = ReminderTimeParse.toEpochMs(fireAt) ?: return "临期：$title"
        val hoursLeft = max(0L, ((dueMs - fireMs) / 3600000.0).roundToLong())
        if (hoursLeft == 0L) return "即将到期：$title"
        if (hoursLeft >= 24L) {
            val days = (hoursLeft / 24.0).roundToLong()
            return "${days}天后：$title"
        }
        return "${hoursLeft}小时后：$title"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_FIRE) return
        val kind = intent.getStringExtra(EXTRA_KIND) ?: KIND_DUE_SOON
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val fireAt = intent.getStringExtra(EXTRA_FIRE_AT) ?: ""
        val dataStore = TodoDataStore(context)
        var raw = dataStore.readText() ?: return
        val task = TodoPersistJson.parseTasks(raw).find { it.id == taskId }
        if (task == null) {
            ReminderScheduler(context).rescheduleAll()
            return
        }
        val title = task.title.ifBlank { "任务" }
        val notifier = TodoNotifier(context)
        when (kind) {
            KIND_TASK_REMINDER -> {
                notifier.show("提醒：$title", "", taskId)
                raw = TaskReminderAdvance.applyAfterFired(raw, taskId) ?: return
            }
            else -> {
                notifier.show(formatDueSoonTitle(task, fireAt), "", taskId)
                if (fireAt.isNotBlank()) {
                    raw = DueSoonNotifyAdvance.applyAfterNotified(raw, taskId, fireAt) ?: return
                }
            }
        }
        dataStore.writeText(raw)
        ReminderScheduler(context).rescheduleAll()
    }

    companion object {
        const val ACTION_FIRE = "com.todo.app.REMINDER_FIRE"
        const val EXTRA_KIND = "kind"
        const val EXTRA_TASK_ID = "taskId"
        const val EXTRA_FIRE_AT = "fireAt"
        const val KIND_DUE_SOON = "due_soon"
        const val KIND_TASK_REMINDER = "task_reminder"
    }
}

package com.todo.app.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.todo.app.data.DueSoonNotifyAdvance
import com.todo.app.data.TaskReminderAdvance
import com.todo.app.data.TodoDataStore
import com.todo.app.data.TodoPersistJson
import com.todo.app.notify.TodoNotifier

class ReminderScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val dataStore = TodoDataStore(context)
    private val registry = ReminderAlarmRegistry(context)

    fun rescheduleAll(): Int {
        cancelAll()
        var raw = dataStore.readText() ?: return 0
        val policy = TodoPersistJson.parseReminderPolicy(raw)
        val tasks = TodoPersistJson.parseTasks(raw)
        val notifier = TodoNotifier(context)

        val dueSoonNow = AutoReminderPlanner.findDueNow(tasks, policy)
        for (slot in dueSoonNow) {
            notifier.show("临期：${slot.task.title}", "", slot.task.id)
            raw = DueSoonNotifyAdvance.applyAfterNotified(raw, slot.task.id, slot.fireAtIso) ?: raw
        }

        val taskRemNow = TaskReminderPlanner.findDueNow(tasks)
        for (slot in taskRemNow) {
            notifier.show("提醒：${slot.task.title}", "", slot.task.id)
            raw = TaskReminderAdvance.applyAfterFired(raw, slot.task.id) ?: raw
        }

        if (dueSoonNow.isNotEmpty() || taskRemNow.isNotEmpty()) {
            dataStore.writeText(raw)
        }

        val refreshed = TodoPersistJson.parseTasks(raw)
        val refreshedPolicy = TodoPersistJson.parseReminderPolicy(raw)
        val scheduled = mutableListOf<ReminderAlarmRegistry.AlarmKey>()
        var count = 0
        for (slot in AutoReminderPlanner.findFutureSlots(refreshed, refreshedPolicy)) {
            scheduleOne(
                ReminderAlarmReceiver.KIND_DUE_SOON,
                slot.task.id,
                slot.fireAtIso,
                slot.fireAtMs,
            )
            scheduled.add(
                ReminderAlarmRegistry.AlarmKey(
                    ReminderAlarmReceiver.KIND_DUE_SOON,
                    slot.task.id,
                    slot.fireAtIso,
                ),
            )
            count++
        }
        for (slot in TaskReminderPlanner.findFutureSlots(refreshed)) {
            scheduleOne(
                ReminderAlarmReceiver.KIND_TASK_REMINDER,
                slot.task.id,
                slot.fireAtIso,
                slot.fireAtMs,
            )
            scheduled.add(
                ReminderAlarmRegistry.AlarmKey(
                    ReminderAlarmReceiver.KIND_TASK_REMINDER,
                    slot.task.id,
                    slot.fireAtIso,
                ),
            )
            count++
        }
        registry.replaceAll(scheduled)
        return count
    }

    private fun scheduleOne(kind: String, taskId: String, fireAtIso: String, atMs: Long) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ReminderAlarmReceiver.ACTION_FIRE
            putExtra(ReminderAlarmReceiver.EXTRA_KIND, kind)
            putExtra(ReminderAlarmReceiver.EXTRA_TASK_ID, taskId)
            putExtra(ReminderAlarmReceiver.EXTRA_FIRE_AT, fireAtIso)
        }
        val reqCode = ReminderAlarmRegistry.AlarmKey.requestCode(kind, taskId, fireAtIso)
        val pi = PendingIntent.getBroadcast(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, atMs, pi)
        }
    }

    fun cancelAll() {
        for (raw in registry.snapshot()) {
            val key = ReminderAlarmRegistry.AlarmKey.decode(raw) ?: continue
            cancelOne(key.kind, key.taskId, key.fireAtIso)
        }
        registry.clear()
    }

    private fun cancelOne(kind: String, taskId: String, fireAtIso: String) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ReminderAlarmReceiver.ACTION_FIRE
            putExtra(ReminderAlarmReceiver.EXTRA_KIND, kind)
            putExtra(ReminderAlarmReceiver.EXTRA_TASK_ID, taskId)
            putExtra(ReminderAlarmReceiver.EXTRA_FIRE_AT, fireAtIso)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            ReminderAlarmRegistry.AlarmKey.requestCode(kind, taskId, fireAtIso),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        )
        if (pi != null) alarmManager.cancel(pi)
    }
}

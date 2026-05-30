package com.todo.app.reminder

import com.todo.app.data.TodoTaskReminder
import java.time.Instant

object TaskReminderPlanner {
    data class Slot(val task: TodoTaskReminder, val fireAtIso: String, val fireAtMs: Long)

    fun findDueNow(
        tasks: List<TodoTaskReminder>,
        nowMs: Long = System.currentTimeMillis(),
    ): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            if (task.completed) continue
            val at = task.reminderAt ?: continue
            val ms = ReminderTimeParse.toEpochMs(at) ?: continue
            if (ms > nowMs) continue
            if (task.reminderLastFiredAt == at) continue
            out.add(Slot(task, at, ms))
        }
        return out.sortedBy { it.fireAtMs }
    }

    fun findFutureSlots(
        tasks: List<TodoTaskReminder>,
        nowMs: Long = System.currentTimeMillis(),
    ): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            if (task.completed) continue
            val at = task.reminderAt ?: continue
            val ms = ReminderTimeParse.toEpochMs(at) ?: continue
            if (ms <= nowMs) continue
            if (task.reminderLastFiredAt == at) continue
            out.add(Slot(task, at, ms))
        }
        return out.sortedBy { it.fireAtMs }
    }

    fun allSlotsForCancel(tasks: List<TodoTaskReminder>): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            val at = task.reminderAt ?: continue
            val ms = ReminderTimeParse.toEpochMs(at) ?: continue
            out.add(Slot(task, at, ms))
        }
        return out
    }
}

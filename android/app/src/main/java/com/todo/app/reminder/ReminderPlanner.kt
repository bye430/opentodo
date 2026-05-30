package com.todo.app.reminder

import com.todo.app.data.ReminderPolicy
import com.todo.app.data.TodoTaskReminder

/** @deprecated 使用 [AutoReminderPlanner] */
object ReminderPlanner {
    fun findFutureReminders(
        tasks: List<TodoTaskReminder>,
        policy: ReminderPolicy,
        nowMs: Long = System.currentTimeMillis(),
    ): List<AutoReminderPlanner.Slot> = AutoReminderPlanner.findFutureSlots(tasks, policy, nowMs)

    fun findDueNow(
        tasks: List<TodoTaskReminder>,
        policy: ReminderPolicy,
        nowMs: Long = System.currentTimeMillis(),
    ): List<AutoReminderPlanner.Slot> = AutoReminderPlanner.findDueNow(tasks, policy, nowMs)
}

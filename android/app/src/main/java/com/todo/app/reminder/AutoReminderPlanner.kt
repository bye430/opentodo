package com.todo.app.reminder

import com.todo.app.data.ReminderPolicy
import com.todo.app.data.TodoTaskReminder
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object AutoReminderPlanner {
    data class Slot(val task: TodoTaskReminder, val fireAtIso: String, val fireAtMs: Long)

    fun taskDueMs(task: TodoTaskReminder): Long? {
        val dueDate = task.dueDate ?: return null
        return try {
            val d = LocalDate.parse(dueDate, DateTimeFormatter.ISO_LOCAL_DATE)
            val parts = task.dueTime?.split(":")?.map { it.toIntOrNull() ?: 0 }
            val hh = parts?.getOrElse(0) { 23 } ?: 23
            val mm = parts?.getOrElse(1) { 59 } ?: 59
            LocalDateTime.of(d.year, d.month, d.dayOfMonth, hh, mm)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    fun computeSlots(task: TodoTaskReminder, policy: ReminderPolicy): List<String> {
        if (task.completed || task.dueDate.isNullOrBlank()) return emptyList()
        val dueMs = taskDueMs(task) ?: return emptyList()
        val msSet = mutableSetOf<Long>()
        val dayMs = 86_400_000L
        val hourMs = 3_600_000L
        if (policy.daysBeforeFirst > 0) {
            msSet.add(dueMs - policy.daysBeforeFirst * dayMs)
        }
        if (policy.daysBeforeSecond > 0) {
            msSet.add(dueMs - policy.daysBeforeSecond * dayMs)
        }
        val windowStart = dueMs - policy.finalHoursBeforeDue * hourMs
        val step = policy.finalIntervalHours * hourMs
        var t = windowStart
        while (t < dueMs) {
            msSet.add(t)
            t += step
        }
        msSet.add(dueMs)
        return msSet.filter { it > 0 }.sorted().map { Instant.ofEpochMilli(it).toString() }
    }

    fun isSlotFired(task: TodoTaskReminder, fireAt: String): Boolean =
        task.dueSoonNotifiedSlots.contains(fireAt)

    fun findDueNow(
        tasks: List<TodoTaskReminder>,
        policy: ReminderPolicy,
        nowMs: Long = System.currentTimeMillis(),
    ): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            if (task.completed || task.dueDate.isNullOrBlank()) continue
            for (iso in computeSlots(task, policy)) {
                val ms = ReminderTimeParse.toEpochMs(iso) ?: continue
                if (ms > nowMs) continue
                if (isSlotFired(task, iso)) continue
                out.add(Slot(task, iso, ms))
            }
        }
        return out.sortedBy { it.fireAtMs }
    }

    fun findFutureSlots(
        tasks: List<TodoTaskReminder>,
        policy: ReminderPolicy,
        nowMs: Long = System.currentTimeMillis(),
    ): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            if (task.completed || task.dueDate.isNullOrBlank()) continue
            for (iso in computeSlots(task, policy)) {
                val ms = ReminderTimeParse.toEpochMs(iso) ?: continue
                if (ms <= nowMs) continue
                if (isSlotFired(task, iso)) continue
                out.add(Slot(task, iso, ms))
            }
        }
        return out.sortedBy { it.fireAtMs }
    }

    fun allSlotsForCancel(tasks: List<TodoTaskReminder>, policy: ReminderPolicy): List<Slot> {
        val out = mutableListOf<Slot>()
        for (task in tasks) {
            for (iso in computeSlots(task, policy)) {
                val ms = ReminderTimeParse.toEpochMs(iso) ?: continue
                out.add(Slot(task, iso, ms))
            }
        }
        return out
    }
}

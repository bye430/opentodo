package com.todo.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object ReminderSlotAdvance {
    private val ymd = DateTimeFormatter.ISO_LOCAL_DATE

    fun applyAfterSlotFired(raw: String?, taskId: String, fireAtIso: String): String? {
        if (raw.isNullOrBlank()) return raw
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: return raw
            val arr = state.optJSONArray("tasks") ?: return raw
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (o.optString("id") != taskId) continue
                val fired = o.optJSONArray("reminderFiredSlots") ?: JSONArray()
                val list = mutableListOf<String>()
                for (j in 0 until fired.length()) {
                    val s = fired.optString(j)
                    if (s.isNotBlank()) list.add(s)
                }
                if (!list.contains(fireAtIso)) list.add(fireAtIso)
                val recurrence = o.optString("recurrence", "none")
                val dueDate = o.optString("dueDate").ifBlank { null }
                val dueTime = o.optString("dueTime").ifBlank { null }
                val dueMs = dueMs(dueDate, dueTime)
                val fireMs = Instant.parse(fireAtIso).toEpochMilli()
                val cycleEnd = dueMs != null && fireMs >= dueMs - 60_000
                if (recurrence != "none" && recurrence.isNotBlank() && cycleEnd && dueDate != null) {
                    o.put("dueDate", advanceDueYmd(dueDate, recurrence))
                    o.put("reminderFiredSlots", JSONArray())
                } else {
                    val next = JSONArray()
                    list.forEach { next.put(it) }
                    o.put("reminderFiredSlots", next)
                }
                break
            }
            root.toString()
        } catch (_: Exception) {
            raw
        }
    }

    private fun dueMs(dueDate: String?, dueTime: String?): Long? {
        if (dueDate.isNullOrBlank()) return null
        return try {
            val d = LocalDate.parse(dueDate, ymd)
            val parts = dueTime?.split(":")?.map { it.toIntOrNull() ?: 0 } ?: listOf(9, 0)
            d.atTime(parts.getOrElse(0) { 9 }, parts.getOrElse(1) { 0 })
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    private fun advanceDueYmd(dueDate: String, recurrence: String): String {
        val d = LocalDate.parse(dueDate, ymd)
        val next = when (recurrence) {
            "weekly" -> d.plusWeeks(1)
            "monthly" -> d.plusMonths(1)
            else -> d.plusDays(1)
        }
        return next.format(ymd)
    }
}

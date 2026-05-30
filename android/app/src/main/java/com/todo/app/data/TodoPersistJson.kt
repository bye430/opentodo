package com.todo.app.data

import org.json.JSONArray
import org.json.JSONObject

data class TodoTaskReminder(
    val id: String,
    val title: String,
    val listId: String,
    val completed: Boolean,
    val dueDate: String?,
    val dueTime: String?,
    val recurrence: String,
    val dueSoonNotifiedSlots: List<String>,
    val reminderAt: String?,
    val reminderLastFiredAt: String?,
)

object TodoPersistJson {
    fun parseReminderPolicy(raw: String?): ReminderPolicy {
        if (raw.isNullOrBlank()) return ReminderPolicy()
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: root
            ReminderPolicy.fromState(state)
        } catch (_: Exception) {
            ReminderPolicy()
        }
    }

    fun parseTasks(raw: String?): List<TodoTaskReminder> {
        if (raw.isNullOrBlank()) return emptyList()
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: root
            val arr = state.optJSONArray("tasks") ?: JSONArray()
            val out = mutableListOf<TodoTaskReminder>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val firedArr = o.optJSONArray("dueSoonNotifiedSlots")
                    ?: o.optJSONArray("reminderFiredSlots")
                    ?: JSONArray()
                val fired = mutableListOf<String>()
                for (j in 0 until firedArr.length()) {
                    val s = firedArr.optString(j)
                    if (s.isNotBlank()) fired.add(s)
                }
                out.add(
                    TodoTaskReminder(
                        id = o.optString("id"),
                        title = o.optString("title", "任务"),
                        listId = o.optString("listId"),
                        completed = o.optBoolean("completed", false),
                        dueDate = o.optString("dueDate").ifBlank { null },
                        dueTime = o.optString("dueTime").ifBlank { null },
                        recurrence = o.optString("recurrence", "none"),
                        dueSoonNotifiedSlots = fired,
                        reminderAt = o.optString("reminderAt").ifBlank { null },
                        reminderLastFiredAt = o.optString("reminderLastFiredAt").ifBlank { null },
                    ),
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun parseMyDayTasks(raw: String?, todayYmd: String, limit: Int = 8): List<Pair<String, String>> {
        if (raw.isNullOrBlank()) return emptyList()
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: root
            val arr = state.optJSONArray("tasks") ?: JSONArray()
            val out = mutableListOf<Pair<String, String>>()
            for (i in 0 until arr.length()) {
                if (out.size >= limit) break
                val o = arr.optJSONObject(i) ?: continue
                if (o.optBoolean("completed", false)) continue
                if (o.optString("myDayDate") != todayYmd) continue
                out.add(o.optString("id") to o.optString("title", "任务"))
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }
}

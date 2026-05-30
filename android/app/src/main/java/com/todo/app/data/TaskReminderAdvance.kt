package com.todo.app.data

import org.json.JSONObject

object TaskReminderAdvance {
    fun applyAfterFired(raw: String?, taskId: String): String? {
        if (raw.isNullOrBlank()) return raw
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: return raw
            val arr = state.optJSONArray("tasks") ?: return raw
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (o.optString("id") != taskId) continue
                val at = o.optString("reminderAt").ifBlank { null } ?: break
                o.put("reminderLastFiredAt", at)
                break
            }
            root.toString()
        } catch (_: Exception) {
            raw
        }
    }
}

package com.todo.app.data

import org.json.JSONArray
import org.json.JSONObject

object DueSoonNotifyAdvance {
    fun applyAfterNotified(raw: String?, taskId: String, fireAtIso: String): String? {
        if (raw.isNullOrBlank()) return raw
        return try {
            val root = JSONObject(raw)
            val state = root.optJSONObject("state") ?: return raw
            val arr = state.optJSONArray("tasks") ?: return raw
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (o.optString("id") != taskId) continue
                val fired = readSlots(o)
                if (!fired.contains(fireAtIso)) fired.add(fireAtIso)
                val next = JSONArray()
                fired.forEach { next.put(it) }
                o.put("dueSoonNotifiedSlots", next)
                o.put("reminderFiredSlots", next)
                break
            }
            root.toString()
        } catch (_: Exception) {
            raw
        }
    }

    private fun readSlots(o: JSONObject): MutableList<String> {
        val fired = o.optJSONArray("dueSoonNotifiedSlots")
            ?: o.optJSONArray("reminderFiredSlots")
            ?: JSONArray()
        val list = mutableListOf<String>()
        for (j in 0 until fired.length()) {
            val s = fired.optString(j)
            if (s.isNotBlank()) list.add(s)
        }
        return list
    }
}

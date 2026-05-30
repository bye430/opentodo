package com.todo.app.reminder

import android.content.Context
import androidx.core.content.edit

/** 记录已调度的闹钟键，便于在任务删除/改期/换库时取消孤儿 Alarm */
class ReminderAlarmRegistry(context: Context) {
    private val prefs =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun snapshot(): Set<String> = prefs.getStringSet(KEY, emptySet()) ?: emptySet()

    fun clear() {
        prefs.edit { remove(KEY) }
    }

    fun replaceAll(entries: Collection<AlarmKey>) {
        val encoded = entries.map { it.encode() }.toSet()
        prefs.edit { putStringSet(KEY, encoded) }
    }

    data class AlarmKey(val kind: String, val taskId: String, val fireAtIso: String) {
        fun encode(): String = "$kind|$taskId|$fireAtIso"

        companion object {
            fun decode(raw: String): AlarmKey? {
                val parts = raw.split("|", limit = 3)
                if (parts.size != 3) return null
                return AlarmKey(parts[0], parts[1], parts[2])
            }

            fun requestCode(kind: String, taskId: String, fireAtIso: String): Int =
                encode(kind, taskId, fireAtIso).hashCode()

            private fun encode(kind: String, taskId: String, fireAtIso: String): String =
                "$kind|$taskId|$fireAtIso"
        }
    }

    companion object {
        private const val PREFS_NAME = "todo_reminder_alarm_registry"
        private const val KEY = "scheduled"
    }
}

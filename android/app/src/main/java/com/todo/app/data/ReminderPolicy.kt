package com.todo.app.data

import org.json.JSONObject

data class ReminderPolicy(
    val daysBeforeFirst: Int = 3,
    val daysBeforeSecond: Int = 1,
    val finalHoursBeforeDue: Int = 24,
    val finalIntervalHours: Int = 2,
) {
    companion object {
        fun fromState(state: JSONObject): ReminderPolicy {
            val o = state.optJSONObject("reminderPolicy") ?: return ReminderPolicy()
            return ReminderPolicy(
                daysBeforeFirst = o.optInt("daysBeforeFirst", 3).coerceIn(0, 30),
                daysBeforeSecond = o.optInt("daysBeforeSecond", 1).coerceIn(0, 30),
                finalHoursBeforeDue = o.optInt("finalHoursBeforeDue", 24).coerceIn(1, 168),
                finalIntervalHours = o.optInt("finalIntervalHours", 2).coerceIn(1, 12),
            )
        }
    }
}

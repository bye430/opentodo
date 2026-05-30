package com.todo.app.reminder

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object ReminderTimeParse {
    fun toEpochMs(iso: String): Long? {
        try {
            return Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            /* fall through */
        }
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        } catch (_: Exception) {
            /* fall through */
        }
        try {
            return LocalDate.parse(iso)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        } catch (_: Exception) {
            return null
        }
    }
}

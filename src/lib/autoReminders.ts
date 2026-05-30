/** @deprecated 请从 dueSoonNotify / taskReminder 导入 */
export {
  DEFAULT_REMINDER_POLICY,
  normalizeReminderPolicy,
  dueSoonSlotsForTask as computeAutoReminderSlots,
  isDueSoonSlotNotified as isSlotFired,
  findDueSoonNotifications as findDueAutoReminders,
  patchAfterDueSoonNotify as patchAfterSlotFire,
  clearDueSoonSlotsIfDueChanged as clearFiredSlotsIfDueChanged,
  dueSoonNotifyBody as reminderBodyForSlot,
  migrateTaskDueSoonFields as migrateTaskReminders,
} from "./dueSoonNotify";

export { taskDueMs, toReminderIso, parseReminderMs } from "./taskReminder";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function rescheduleAndroidReminders(): void {
  const api = window.todoReminders;
  if (!api?.reschedule) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void api.reschedule();
  }, 400);
}

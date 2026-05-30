/** 收起软键盘（WebView / 浏览器） */
export function dismissKeyboard(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement) {
    el.blur();
  }
}

export function isClockPickerOpen(): boolean {
  return Boolean(document.querySelector("[data-clock-picker-open]"));
}

/** 是否在 Android WebView 壳内 */
export function isAndroid(): boolean {
  return typeof window !== "undefined" && window.desktop?.platform === "android";
}

const MOBILE_MQ = "(max-width: 767px)";

/** 窄屏或 Android：启用触屏向交互 */
export function isMobileUi(): boolean {
  if (typeof window === "undefined") return false;
  if (isAndroid()) return true;
  return window.matchMedia(MOBILE_MQ).matches;
}

export function useMobileUi(): boolean {
  if (typeof window === "undefined") return false;
  return isMobileUi();
}

import { initAppNavigation, teardownAppNavigation } from "./appNavigation";

export function registerAndroidBackHandler(): void {
  initAppNavigation();
}

export function unregisterAndroidBackHandler(): void {
  teardownAppNavigation();
}

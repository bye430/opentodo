import { useAppStore } from "../store/appStore";
import { isAndroid, isMobileUi } from "./platform";

let listSelectionActive = false;
let appMenuOpen = false;
let addTaskPickPanelOpen = false;
let closeAppMenu: (() => void) | null = null;
let closeAddTaskPickPanels: (() => void) | null = null;
let storeUnsubscribe: (() => void) | null = null;
const extraBackHandlers: Array<() => boolean> = [];

function isTaskDetailVisible(): boolean {
  const s = useAppStore.getState();
  return isMobileUi() && Boolean(s.taskPaneOpen || s.selectedTaskId);
}

function computeNeedBackIntercept(): boolean {
  if (!isAndroid()) return false;
  const s = useAppStore.getState();
  return (
    listSelectionActive ||
    appMenuOpen ||
    addTaskPickPanelOpen ||
    isTaskDetailVisible() ||
    s.sidebarOpen
  );
}

/** 由 Zustand 订阅与列表多选共同驱动，事前告知 Android 是否拦截系统返回 */
export function syncAndroidBackIntercept(): void {
  const api = window.AndroidTodo;
  if (!api?.setBackIntercept) return;
  api.setBackIntercept(computeNeedBackIntercept());
}

export function setListSelectionActive(active: boolean): void {
  listSelectionActive = active;
  syncAndroidBackIntercept();
}

export function setAppMenuOpen(open: boolean) {
  appMenuOpen = open;
  syncAndroidBackIntercept();
}

export function bindAppMenuCloser(close: () => void): () => void {
  closeAppMenu = close;
  return () => {
    if (closeAppMenu === close) closeAppMenu = null;
  };
}

export function setAddTaskPickPanelOpen(open: boolean) {
  addTaskPickPanelOpen = open;
  syncAndroidBackIntercept();
}

export function bindAddTaskPickCloser(close: () => void): () => void {
  closeAddTaskPickPanels = close;
  return () => {
    if (closeAddTaskPickPanels === close) closeAddTaskPickPanels = null;
  };
}

/** 注册额外返回处理（如列表多选），后注册者优先 */
export function registerBackHandler(handler: () => boolean): () => void {
  extraBackHandlers.push(handler);
  return () => {
    const i = extraBackHandlers.indexOf(handler);
    if (i >= 0) extraBackHandlers.splice(i, 1);
  };
}

/** 系统返回 / 左滑时由 Android 同步调用，只关 UI，不碰 history */
export function handleAppBack(): void {
  if (appMenuOpen && closeAppMenu) {
    closeAppMenu();
    return;
  }

  for (let i = extraBackHandlers.length - 1; i >= 0; i--) {
    if (extraBackHandlers[i]()) return;
  }

  if (addTaskPickPanelOpen && closeAddTaskPickPanels) {
    closeAddTaskPickPanels();
    return;
  }

  const s = useAppStore.getState();

  if (isTaskDetailVisible()) {
    closeTaskDetail();
    return;
  }

  if (s.sidebarOpen) {
    closeSidebar();
  }
}

export function openTaskDetail(taskId: string) {
  useAppStore.setState({
    selectedTaskId: taskId,
    taskPaneOpen: true,
  });
  syncAndroidBackIntercept();
}

export function closeTaskDetail() {
  useAppStore.setState({
    taskPaneOpen: false,
    selectedTaskId: null,
  });
  syncAndroidBackIntercept();
}

export function openSidebar() {
  useAppStore.getState().setSidebarOpen(true);
  syncAndroidBackIntercept();
}

export function closeSidebar() {
  useAppStore.getState().setSidebarOpen(false);
  syncAndroidBackIntercept();
}

export function toggleSidebar() {
  const s = useAppStore.getState();
  if (s.sidebarOpen) closeSidebar();
  else openSidebar();
}

export function initAppNavigation(): void {
  if (typeof window === "undefined") return;

  window.__todoHandleBack = () => {
    handleAppBack();
    return true;
  };

  if (!isAndroid()) return;

  storeUnsubscribe?.();
  storeUnsubscribe = useAppStore.subscribe((state, prev) => {
    if (
      state.sidebarOpen === prev.sidebarOpen &&
      state.taskPaneOpen === prev.taskPaneOpen &&
      state.selectedTaskId === prev.selectedTaskId
    ) {
      return;
    }
    syncAndroidBackIntercept();
  });
  syncAndroidBackIntercept();
}

export function teardownAppNavigation(): void {
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  listSelectionActive = false;
  appMenuOpen = false;
  addTaskPickPanelOpen = false;
  closeAppMenu = null;
  closeAddTaskPickPanels = null;
  if (typeof window !== "undefined") {
    delete window.__todoHandleBack;
    window.AndroidTodo?.setBackIntercept(false);
  }
}

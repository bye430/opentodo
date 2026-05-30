/// <reference types="vite/client" />

export type DesktopBridge = {
  isDesktop: true;
  platform: NodeJS.Platform | "android";
};

export type TodoNotifyApi = {
  show: (
    title: string,
    body?: string,
    taskId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Electron：用户点击通知时回调 */
  onOpenTask?: (handler: (taskId: string) => void) => () => void;
};

export type TodoSchedulerApi = {
  register: () => Promise<{
    ok: boolean;
    kind?: string;
    error?: string;
  }>;
  unregister: () => Promise<{ ok: boolean; error?: string }>;
  status: () => Promise<{ registered: boolean; kind?: string }>;
};

export type TodoRemindersApi = {
  reschedule: () => Promise<{ ok: boolean; error?: string }>;
};

export type TodoAndroidShellApi = {
  openNotificationSettings: () => Promise<{ ok: boolean }>;
  openBatterySettings: () => Promise<{ ok: boolean }>;
  pickListBackgroundImage: (listId: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
};

export type TodoLaunchParams = {
  view?: "my-day" | "list" | "important" | "planned" | "all";
  listId?: string;
  taskId?: string;
  focusAdd?: boolean;
};

export type TodoDataApi = {
  /** 非空表示使用磁盘文件作为 zustand 持久化目标 */
  dataFilePath: string;
  read: () => Promise<string | null>;
  write: (text: string) => Promise<void>;
  remove: () => Promise<void>;
  pickPath: () => Promise<string | null>;
  setPath: (absPath: string | null) => Promise<{ ok: boolean; error?: string }>;
  getPath: () => Promise<string>;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
    todoData?: TodoDataApi;
    todoNotify?: TodoNotifyApi;
    todoScheduler?: TodoSchedulerApi;
    todoReminders?: TodoRemindersApi;
    todoAndroid?: TodoAndroidShellApi;
    todoLaunch?: TodoLaunchParams;
    __todoHandleBack?: () => boolean | void;
    /** Android 热启动：通知点击等，持久化就绪后由 App 注册 */
    __todoApplyLaunch?: (params: TodoLaunchParams) => void;
    /** Android @JavascriptInterface，与 Kotlin 侧 AndroidTodo 同名 */
    AndroidTodo?: {
      setBackIntercept: (intercept: boolean) => void;
    };
    __todoBackgroundListId?: string;
  }
}

export {};

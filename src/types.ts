export type ThemeMode = "system" | "light" | "dark";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

/** 全局临期通知策略（有截止日的未完成任务，仅状态栏通知） */
export type ReminderPolicy = {
  /** 截止前 N 天提醒一次（默认 3） */
  daysBeforeFirst: number;
  /** 截止前 N 天再提醒一次（默认 1） */
  daysBeforeSecond: number;
  /** 截止前多少小时内密集提醒（默认 24） */
  finalHoursBeforeDue: number;
  /** 密集提醒间隔（小时，默认 2） */
  finalIntervalHours: number;
};

export type ListBackground = {
  type: "none" | "solid" | "image";
  value: string;
};

export type ListGroup = {
  id: string;
  name: string;
  sortOrder: number;
  collapsed: boolean;
};

export type List = {
  id: string;
  name: string;
  groupId: string | null;
  sortOrder: number;
  background: ListBackground;
};

export type Step = {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
};

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  dataBase64: string;
  size: number;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  notes: string;
  completed: boolean;
  starred: boolean;
  dueDate: string | null;
  dueTime: string | null;
  /** 任务详情中设置的「提醒我」时刻（ISO），与截止日独立 */
  reminderAt: string | null;
  /** 该 reminderAt 已触发过提醒则记录同一 ISO */
  reminderLastFiredAt: string | null;
  /** 全局临期通知已推送的时刻（ISO） */
  dueSoonNotifiedSlots: string[];
  /** @deprecated 迁移为 dueSoonNotifiedSlots */
  reminderFiredSlots?: string[];
  recurrence: Recurrence;
  category: string;
  tags: string;
  sortOrder: number;
  myDayDate: string | null;
  steps: Step[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type SmartView =
  | { kind: "my-day" }
  | { kind: "important" }
  | {
      kind: "planned";
      bucket: "all" | "overdue" | "today" | "tomorrow" | "later";
    }
  | { kind: "all" }
  | { kind: "list"; listId: string };

export type AppStateV1 = {
  version: 1;
  exportedAt?: string;
  theme: ThemeMode;
  hideCompleted: boolean;
  /** 侧栏 TODO 标题下的格言，可编辑 */
  sidebarMotto: string;
  /** 全局临期通知策略 */
  reminderPolicy: ReminderPolicy;
  lastCalendarDate: string;
  listGroups: ListGroup[];
  lists: List[];
  tasks: Task[];
};

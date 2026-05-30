import { useAppStore } from "../store/appStore";
import { openTaskDetail } from "./appNavigation";
export type TodoLaunchParams = {
  view?: "my-day" | "list" | "important" | "planned" | "all";
  listId?: string;
  taskId?: string;
  focusAdd?: boolean;
};

/** 通知/深链打开任务；任务不存在时静默忽略 */
export function applyTodoLaunch(launch: TodoLaunchParams): void {
  const st = useAppStore.getState();
  if (launch.view === "my-day") st.setCurrentView({ kind: "my-day" });
  else if (launch.view === "important") st.setCurrentView({ kind: "important" });
  else if (launch.view === "planned")
    st.setCurrentView({ kind: "planned", bucket: "all" });
  else if (launch.view === "all") st.setCurrentView({ kind: "all" });
  else if (launch.view === "list" && launch.listId)
    st.setCurrentView({ kind: "list", listId: launch.listId });

  if (launch.taskId) {
    const task = st.tasks.find((t) => t.id === launch.taskId);
    if (task) openTaskDetail(launch.taskId);
  }

  if (launch.focusAdd) {
    window.setTimeout(() => {
      document.getElementById("todo-add-task")?.focus();
    }, 300);
  }
}

export function registerTodoLaunchHandler(): () => void {
  window.__todoApplyLaunch = (launch) => applyTodoLaunch(launch);
  return () => {
    delete window.__todoApplyLaunch;
  };
}

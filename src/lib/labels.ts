import type { SmartView } from "../types";
export function viewLabel(
  view: SmartView,
  lists: { id: string; name: string }[],
): string {
  switch (view.kind) {
    case "my-day":
      return "我的一天";
    case "important":
      return "重要";
    case "planned":
      switch (view.bucket) {
        case "all":
          return "计划内";
        case "overdue":
          return "计划内 · 已逾期";
        case "today":
          return "计划内 · 今天";
        case "tomorrow":
          return "计划内 · 明天";
        case "later":
          return "计划内 · 以后";
        default:
          return "计划内";
      }
    case "all":
      return "全部";
    case "list":
      return lists.find((l) => l.id === view.listId)?.name ?? "列表";
    default:
      return "";
  }
}

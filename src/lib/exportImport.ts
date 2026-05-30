import type { AppStateV1 } from "../types";

export function buildExportPayload(state: Omit<AppStateV1, "exportedAt">): AppStateV1 {
  return {
    ...state,
    exportedAt: new Date().toISOString(),
  };
}

export function downloadJson(filename: string, data: AppStateV1): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportJson(text: string): AppStateV1 {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object") throw new Error("无效 JSON");
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) throw new Error("仅支持 version: 1");
  if (!Array.isArray(o.listGroups)) throw new Error("缺少 listGroups");
  if (!Array.isArray(o.lists)) throw new Error("缺少 lists");
  if (!Array.isArray(o.tasks)) throw new Error("缺少 tasks");
  return raw as AppStateV1;
}

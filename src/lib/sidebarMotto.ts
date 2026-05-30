export const DEFAULT_SIDEBAR_MOTTO = "及时当勉励，岁月不待人。";

export function normalizeSidebarMotto(value: string | undefined | null): string {
  const t = value?.trim();
  return t && t.length > 0 ? t : DEFAULT_SIDEBAR_MOTTO;
}

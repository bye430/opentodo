/** 固定键：保存「浏览器端 localStorage 数据键」配置，与业务数据分离 */
export const STORAGE_META_KEY = "todo-storage-meta";

export const DEFAULT_BROWSER_PERSIST_KEY = "todo-web-v1";

const KEY_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export type StorageMeta = {
  persistKey: string;
  encrypt: boolean;
  encryptPassword?: string;
};

export function isValidBrowserPersistKey(key: string): boolean {
  const k = key.trim();
  return KEY_PATTERN.test(k);
}

function generateRandomPassword(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function readStorageMeta(): StorageMeta {
  const def: StorageMeta = { persistKey: DEFAULT_BROWSER_PERSIST_KEY, encrypt: true };
  if (typeof localStorage === "undefined") return def;
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY);
    if (!raw) {
      def.encryptPassword = generateRandomPassword();
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(def));
      return def;
    }
    const o = JSON.parse(raw) as Partial<StorageMeta>;
    const meta: StorageMeta = {
      persistKey: typeof o.persistKey === "string" && isValidBrowserPersistKey(o.persistKey) ? o.persistKey : def.persistKey,
      encrypt: typeof o.encrypt === "boolean" ? o.encrypt : def.encrypt,
      encryptPassword: typeof o.encryptPassword === "string" ? o.encryptPassword : undefined,
    };
    if (meta.encrypt && !meta.encryptPassword) {
      meta.encryptPassword = generateRandomPassword();
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    }
    return meta;
  } catch {
    return def;
  }
}

export function writeStorageMeta(meta: StorageMeta): void {
  if (!isValidBrowserPersistKey(meta.persistKey)) {
    throw new Error("存储键格式无效：仅允许字母、数字、._:-，长度 1–128");
  }
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
}

export function readBrowserPersistKey(): string {
  return readStorageMeta().persistKey;
}

export function writeBrowserPersistKey(persistKey: string): void {
  const meta = readStorageMeta();
  meta.persistKey = persistKey;
  writeStorageMeta(meta);
}

import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { readStorageMeta } from "./storageMeta";
import { encryptText, decryptText } from "./crypto";

function createKeyedLocalStorage(): StateStorage {
  return {
    getItem: async (_name) => {
      const meta = readStorageMeta();
      const val = localStorage.getItem(meta.persistKey);
      if (!val) return null;
      if (meta.encrypt && meta.encryptPassword) {
        try {
          return await decryptText(val, meta.encryptPassword);
        } catch (e) {
          console.error("Decrypt failed", e);
          return val;
        }
      }
      return val;
    },
    setItem: async (_name, value) => {
      const meta = readStorageMeta();
      let toSave = value;
      if (meta.encrypt && meta.encryptPassword) {
        toSave = await encryptText(value, meta.encryptPassword);
      }
      localStorage.setItem(meta.persistKey, toSave);
    },
    removeItem: (_name) => {
      const meta = readStorageMeta();
      localStorage.removeItem(meta.persistKey);
    },
  };
}

function createElectronFileStorage(): StateStorage {
  const api = window.todoData;
  if (!api) {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return {
    getItem: async (_name) => {
      const meta = readStorageMeta();
      const val = await api.read();
      if (!val) return null;
      if (meta.encrypt && meta.encryptPassword) {
        try {
          return await decryptText(val, meta.encryptPassword);
        } catch (e) {
          console.error("Decrypt failed", e);
          return val;
        }
      }
      return val;
    },
    setItem: async (_name, value) => {
      const meta = readStorageMeta();
      let toSave = value;
      if (meta.encrypt && meta.encryptPassword) {
        toSave = await encryptText(value, meta.encryptPassword);
      }
      await api.write(toSave);
    },
    removeItem: (_name) => api.remove(),
  };
}

/** 供 zustand persist：桌面且已配置文件路径时用磁盘文件，否则用可配置的 localStorage 键 */
export function getAppPersistStorage() {
  const usesFile =
    typeof window !== "undefined" && window.todoData && window.todoData.dataFilePath.length > 0;
  if (usesFile) {
    return createJSONStorage(() => createElectronFileStorage());
  }
  return createJSONStorage(() => createKeyedLocalStorage());
}

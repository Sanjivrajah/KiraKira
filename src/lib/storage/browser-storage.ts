import { RepositoryError } from "@/repositories/contracts";

export interface KeyValueStorage {
  has(key: string): boolean;
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export function getBrowserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export class BrowserStorage implements KeyValueStorage {
  constructor(private readonly resolveStorage: () => Storage | undefined = getBrowserStorage) {}

  has(key: string): boolean {
    const storage = this.resolveStorage();
    if (!storage) return false;
    try {
      return storage.getItem(key) !== null;
    } catch (cause) {
      throw new RepositoryError("Stored data could not be read.", "READ_FAILED", { cause });
    }
  }

  get<T>(key: string, fallback: T): T {
    const storage = this.resolveStorage();
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    const storage = this.resolveStorage();
    if (!storage) throw new RepositoryError("Browser storage is unavailable.", "WRITE_FAILED");
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (cause) {
      throw new RepositoryError("Stored data could not be saved.", "WRITE_FAILED", { cause });
    }
  }

  remove(key: string): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (cause) {
      throw new RepositoryError("Stored data could not be removed.", "WRITE_FAILED", { cause });
    }
  }
}

export const browserStorage = new BrowserStorage();

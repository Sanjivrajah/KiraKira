import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class LocalJsonStoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalJsonStoreError";
  }
}

let operationQueue = Promise.resolve();

/** Serialises read-modify-write operations performed by this bot process. */
export function withLocalStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export class JsonArrayStore<T> {
  constructor(private readonly filePath: string) {}

  async read(): Promise<T[]> {
    await mkdir(dirname(this.filePath), { recursive: true });

    let content: string;
    try {
      content = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        await this.write([]);
        return [];
      }
      throw new LocalJsonStoreError(`Unable to read local data file ${this.filePath}.`, { cause: error });
    }

    if (!content.trim()) {
      await this.write([]);
      return [];
    }
    try {
      const value: unknown = JSON.parse(content);
      if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
      return value as T[];
    } catch (error) {
      throw new LocalJsonStoreError(`Local data file ${this.filePath} contains invalid JSON.`, { cause: error });
    }
  }

  async write(records: T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      throw new LocalJsonStoreError(`Unable to write local data file ${this.filePath}.`, { cause: error });
    }
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

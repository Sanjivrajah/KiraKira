import type { KeyValueStorage } from "@/lib/storage/browser-storage";
import { RepositoryError } from "@/repositories/contracts";

export abstract class LocalEntityStore<T extends { id: string; businessId?: string }> {
  constructor(
    private readonly key: string,
    protected readonly storage: KeyValueStorage,
    private readonly parse: (value: unknown) => T | null,
  ) {}

  protected readAll(): T[] {
    const values = this.storage.get<unknown>(this.key, []);
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.reduce<T[]>((result, value) => {
      const entity = this.parse(value);
      if (entity && !seen.has(entity.id)) {
        seen.add(entity.id);
        result.push(entity);
      }
      return result;
    }, []);
  }

  protected writeAll(values: T[]): void {
    this.storage.set(this.key, values);
  }

  protected hasStoredValue(): boolean {
    return this.storage.has(this.key);
  }

  protected createEntity(entity: T): T {
    const values = this.readAll();
    if (values.some((value) => value.id === entity.id)) {
      throw new RepositoryError("A record with this ID already exists.", "INVALID_DATA");
    }
    this.writeAll([entity, ...values]);
    return entity;
  }

  protected updateEntity(id: string, changes: Partial<T>, businessId?: string): T {
    const values = this.readAll();
    const index = values.findIndex((value) => value.id === id && (businessId === undefined || value.businessId === businessId));
    if (index < 0) throw new RepositoryError("The requested record was not found.", "NOT_FOUND");
    const updated = { ...values[index], ...changes, id: values[index].id };
    values[index] = updated;
    this.writeAll(values);
    return updated;
  }

  protected removeEntity(id: string, businessId?: string): void {
    const values = this.readAll();
    this.writeAll(values.filter((value) => value.id !== id || (businessId !== undefined && value.businessId !== businessId)));
  }

  protected clearAll(): void {
    this.storage.remove(this.key);
  }
}

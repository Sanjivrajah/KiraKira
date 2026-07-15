/** Database rows stay in infrastructure; domain entities stay in domain/application code. */
export interface PersistenceMapper<Row, Entity> {
  toDomain(row: Row): Entity;
  toRow(entity: Entity): Row;
}

export interface BusinessOwnedRow {
  business_id: string;
}

export interface VersionedRow {
  created_at: string;
  updated_at: string;
  version: number;
}


import type { AuditableEntity, EntityId, ISODateTimeString, MoneyAmount } from "./common";

export interface InventoryItem extends AuditableEntity {
  businessId: EntityId;
  name: string;
  sku?: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel?: number | null;
  unitCost?: MoneyAmount | null;
  active: boolean;
}

export type InventoryMovementType = "purchase" | "sale" | "adjustment" | "return" | "waste";

export interface InventoryMovement extends AuditableEntity {
  businessId: EntityId;
  inventoryItemId: EntityId;
  type: InventoryMovementType;
  quantity: number;
  occurredAt: ISODateTimeString;
  transactionId?: EntityId | null;
  notes?: string | null;
}

import { z } from "zod";
import type { EntityId, UserId } from "./identifiers";
import { entityIdSchema, userIdSchema } from "./identifiers";
import type { ISODateTime } from "./dates";
import { isoDateTimeSchema } from "./dates";

export interface AuditableEntity {
  id: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy?: UserId;
  updatedBy?: UserId;
  version?: number;
}

export const auditableEntitySchema = z
  .object({
    id: entityIdSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();

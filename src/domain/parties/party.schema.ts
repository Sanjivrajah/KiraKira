import { z } from "zod";
import { addressSchema } from "../addresses";
import {
  currencyCodeSchema,
  isoDateTimeSchema,
  partyIdSchema,
  userIdSchema,
} from "../common";
import { registrationIdentifierSchema, taxIdentifierSchema } from "./identifiers";

const partyNameSchema = z.string().trim().min(1).max(200);

export const partySchema = z
  .object({
    id: partyIdSchema,
    kind: z.enum([
      "business",
      "individual",
      "government_entity",
      "foreign_entity",
      "general_public",
    ]),
    legalName: partyNameSchema,
    tradingName: partyNameSchema.optional(),
    roles: z
      .array(z.enum(["buyer", "seller", "customer", "supplier", "payer", "payee"]))
      .min(1)
      .refine((roles) => new Set(roles).size === roles.length, "Party roles must be unique."),
    taxIdentifiers: z.array(taxIdentifierSchema).default([]),
    registrationIdentifiers: z.array(registrationIdentifierSchema).default([]),
    email: z.email().optional(),
    phone: z.string().trim().min(5).max(30).optional(),
    billingAddress: addressSchema.optional(),
    shippingAddress: addressSchema.optional(),
    defaultCurrency: currencyCodeSchema.optional(),
    defaultPaymentTermsDays: z.number().int().min(0).max(3650).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();

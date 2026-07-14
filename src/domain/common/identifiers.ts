import { z } from "zod";

declare const identifierBrand: unique symbol;

type BrandedIdentifier<Name extends string> = string & {
  readonly [identifierBrand]: Name;
};

export type EntityId = BrandedIdentifier<"EntityId">;
export type BusinessId = BrandedIdentifier<"BusinessId">;
export type PartyId = BrandedIdentifier<"PartyId">;
export type DocumentId = BrandedIdentifier<"DocumentId">;
export type TransactionId = BrandedIdentifier<"TransactionId">;
export type SourceDocumentId = BrandedIdentifier<"SourceDocumentId">;
export type UserId = BrandedIdentifier<"UserId">;

const identifierValueSchema = z
  .string()
  .trim()
  .min(1, "An identifier is required.")
  .max(128, "Identifiers must not exceed 128 characters.")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "Identifiers may contain letters, numbers, dots, underscores, colons, and hyphens.",
  );

const brandedIdentifierSchema = <Identifier extends string>() =>
  identifierValueSchema.transform((value) => value as Identifier);

export const entityIdSchema = brandedIdentifierSchema<EntityId>();
export const businessIdSchema = brandedIdentifierSchema<BusinessId>();
export const partyIdSchema = brandedIdentifierSchema<PartyId>();
export const documentIdSchema = brandedIdentifierSchema<DocumentId>();
export const transactionIdSchema = brandedIdentifierSchema<TransactionId>();
export const sourceDocumentIdSchema = brandedIdentifierSchema<SourceDocumentId>();
export const userIdSchema = brandedIdentifierSchema<UserId>();

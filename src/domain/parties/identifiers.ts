import { z } from "zod";
import { countryCodeSchema } from "../addresses";

export type TaxIdentifierScheme = "tin" | "sst" | "tourism_tax" | "other_tax";
export type RegistrationIdentifierScheme = "brn" | "nric" | "passport" | "army_number" | "other";

export interface TaxIdentifier {
  scheme: TaxIdentifierScheme;
  value: string;
  issuingCountryCode?: string;
  description?: string;
}

export interface RegistrationIdentifier {
  scheme: RegistrationIdentifierScheme;
  value: string;
  issuingCountryCode?: string;
  description?: string;
}

const identifierValueSchema = z
  .string()
  .trim()
  .min(1, "Identifier value is required.")
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ./_-]*$/, "Identifier contains unsupported characters.");

const descriptionSchema = z.string().trim().min(2).max(100);

function requireOtherDescription(
  identifier: { scheme: string; description?: string },
  context: z.RefinementCtx,
) {
  if (identifier.scheme.startsWith("other") && !identifier.description) {
    context.addIssue({
      code: "custom",
      path: ["description"],
      message: "Describe identifiers that use an other scheme.",
    });
  }
}

export const taxIdentifierSchema = z
  .object({
    scheme: z.enum(["tin", "sst", "tourism_tax", "other_tax"]),
    value: identifierValueSchema,
    issuingCountryCode: countryCodeSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .strict()
  .superRefine(requireOtherDescription);

export const registrationIdentifierSchema = z
  .object({
    scheme: z.enum(["brn", "nric", "passport", "army_number", "other"]),
    value: identifierValueSchema,
    issuingCountryCode: countryCodeSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .strict()
  .superRefine(requireOtherDescription);

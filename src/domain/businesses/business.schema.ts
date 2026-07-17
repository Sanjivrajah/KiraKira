import { z } from "zod";
import { addressSchema } from "../addresses";
import {
  businessIdSchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  userIdSchema,
} from "../common";
import { registrationIdentifierSchema, taxIdentifierSchema } from "../parties";

const secretReferenceSchema = z
  .string()
  .trim()
  .regex(
    /^secret:\/\/[A-Za-z0-9][A-Za-z0-9/_.:-]*$/,
    "Use an opaque secret reference beginning with secret://.",
  );

export const myInvoisIntegrationConfigurationSchema = z
  .object({
    environment: z.enum(["sandbox", "production"]),
    clientIdSecretRef: secretReferenceSchema,
    clientSecretSecretRef: secretReferenceSchema,
  })
  .strict();

export const businessComplianceProfileSchema = z
  .object({
    tin: taxIdentifierSchema
      .refine((identifier) => identifier.scheme === "tin", "The primary tax identifier must be a TIN.")
      .optional(),
    registration: registrationIdentifierSchema.optional(),
    sstRegistrations: z
      .array(
        taxIdentifierSchema.refine(
          (identifier) => identifier.scheme === "sst",
          "SST registrations must use the SST scheme.",
        ),
      )
      .default([]),
    tourismTaxRegistration: taxIdentifierSchema
      .refine(
        (identifier) => identifier.scheme === "tourism_tax",
        "Tourism tax registration must use the tourism tax scheme.",
      )
      .optional(),
    msicCode: z.string().regex(/^\d{5}$/, "MSIC code must contain five digits.").optional(),
    businessActivityDescription: z.string().trim().min(2).max(300).optional(),
  })
  .strict();

export const businessContactDetailsSchema = z
  .object({
    email: z.email().optional(),
    phone: z.string().trim().min(5).max(30).optional(),
  })
  .strict();

export const businessDomainSchema = z
  .object({
    id: businessIdSchema,
    legalName: z.string().trim().min(2).max(200),
    tradingName: z.string().trim().min(1).max(200).optional(),
    entityType: z.enum([
      "sole_proprietorship",
      "partnership",
      "limited_liability_partnership",
      "private_limited_company",
      "public_limited_company",
      "association",
      "government_entity",
      "individual",
      "foreign_entity",
      "other",
    ]),
    compliance: businessComplianceProfileSchema,
    contact: businessContactDetailsSchema,
    address: addressSchema,
    defaultCurrency: currencyCodeSchema,
    preferredLanguage: z.enum(["en", "ms"]),
    timezone: z
      .string()
      .regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/, "Use an IANA timezone such as Asia/Kuala_Lumpur."),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
    myInvois: myInvoisIntegrationConfigurationSchema.optional(),
  })
  .strict()
  .superRefine((business, ctx) => {
    if (business.myInvois) {
      if (!business.contact.phone) {
        ctx.addIssue({
          code: "custom",
          path: ["contact", "phone"],
          message: "Contact phone is required when MyInvois integration is enabled.",
        });
      }
      if (!business.compliance.tin) {
        ctx.addIssue({
          code: "custom",
          path: ["compliance", "tin"],
          message: "TIN is required when MyInvois integration is enabled.",
        });
      }
      if (!business.compliance.registration) {
        ctx.addIssue({
          code: "custom",
          path: ["compliance", "registration"],
          message: "Registration identifier is required when MyInvois integration is enabled.",
        });
      }
      if (!business.compliance.msicCode) {
        ctx.addIssue({
          code: "custom",
          path: ["compliance", "msicCode"],
          message: "MSIC code is required when MyInvois integration is enabled.",
        });
      }
      if (!business.compliance.businessActivityDescription) {
        ctx.addIssue({
          code: "custom",
          path: ["compliance", "businessActivityDescription"],
          message: "Business activity description is required when MyInvois integration is enabled.",
        });
      }
    }
  });

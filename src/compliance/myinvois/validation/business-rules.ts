import type { MyInvoisValidationRule } from "./validation-rule";

const countryAliases: Record<string, string> = { MY: "MYS", SG: "SGP", GB: "GBR" };

export const businessRules: MyInvoisValidationRule[] = [
  {
    ruleId: "supplier.identity.present",
    category: "invoice",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ supplier }) => supplier?.legalName ? [] : [{}],
    fieldPath: "supplier.legalName",
    message: "Supplier legal name is required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Supplier",
  },
  {
    ruleId: "supplier.tin.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ supplier }) => supplier?.taxIdentifiers.some((identifier) => identifier.scheme === "tin") ? [] : [{}],
    fieldPath: "supplier.taxIdentifiers",
    message: "Supplier TIN is required for MyInvois submission.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Supplier TIN",
  },
  {
    ruleId: "supplier.registration.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ supplier }) => supplier?.registrationIdentifiers.length ? [] : [{}],
    fieldPath: "supplier.registrationIdentifiers",
    message: "Supplier registration or identification number is required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Supplier Identification",
  },
  {
    ruleId: "supplier.contact.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ supplier }) => supplier?.phone && supplier.billingAddress ? [] : [
      ...(!supplier?.phone ? [{ fieldPath: "supplier.phone", message: "Supplier contact number is required." }] : []),
      ...(!supplier?.billingAddress ? [{ fieldPath: "supplier.billingAddress", message: "Supplier address is required." }] : []),
    ],
    fieldPath: "supplier",
    message: "Supplier contact and address are required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Supplier Contact",
  },
  {
    ruleId: "supplier.address.valid",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ supplier, referenceData, asOfDate }) => {
      const address = supplier?.billingAddress;
      if (!address) return [];
      const countryCode = countryAliases[address.countryCode];
      const failures = !countryCode || !referenceData.isActive("country", countryCode, asOfDate)
        ? [{ fieldPath: "supplier.billingAddress.countryCode", message: "Supplier country is not available in current MyInvois reference data." }]
        : [];
      if (address.countryCode === "MY" && (!address.stateCode || !referenceData.isActive("state", address.stateCode, asOfDate) || address.stateCode === "17")) {
        failures.push({ fieldPath: "supplier.billingAddress.stateCode", message: "Malaysian supplier requires an active state code from 01 to 16; state 17 is not valid for a Malaysian supplier address." });
      }
      return failures;
    },
    fieldPath: "supplier.billingAddress",
    message: "Supplier address must use active country/state codes.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Address",
  },
  {
    ruleId: "supplier.msic.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ business, referenceData, asOfDate }) => {
      const code = business?.compliance.msicCode;
      return code && referenceData.isActive("msic", code, asOfDate) ? [] : [{}];
    },
    fieldPath: "business.compliance.msicCode",
    message: "An active MSIC code is required.",
    sourceReferenceLabel: "MyInvois MSIC Codes",
  },
  {
    ruleId: "supplier.activity.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ business }) => business?.compliance.businessActivityDescription ? [] : [{}],
    fieldPath: "business.compliance.businessActivityDescription",
    message: "Supplier business activity description is required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Supplier Activity",
  },
];

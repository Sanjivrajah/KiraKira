import type { MyInvoisValidationRule } from "./validation-rule";

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

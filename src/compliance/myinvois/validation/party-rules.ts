import type { MyInvoisValidationRule } from "./validation-rule";

const isGeneralPublic = (scenario: string) => scenario === "consolidated_transaction";
const countryAliases: Record<string, string> = { MY: "MYS", SG: "SGP", GB: "GBR" };

export const partyRules: MyInvoisValidationRule[] = [
  {
    ruleId: "buyer.identity.present",
    category: "invoice",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ buyer }) => buyer?.legalName ? [] : [{}],
    fieldPath: "buyer.legalName",
    message: "Buyer legal name is required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Buyer",
  },
  {
    ruleId: "buyer.tin.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ scenario }) => !isGeneralPublic(scenario),
    validate: ({ buyer }) => buyer?.taxIdentifiers.some((identifier) => identifier.scheme === "tin") ? [] : [{}],
    fieldPath: "buyer.taxIdentifiers",
    message: "Buyer TIN is required for this scenario.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Buyer TIN",
  },
  {
    ruleId: "buyer.registration.present",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ scenario }) => !isGeneralPublic(scenario),
    validate: ({ buyer }) => buyer?.registrationIdentifiers.length ? [] : [{}],
    fieldPath: "buyer.registrationIdentifiers",
    message: "Buyer registration or identification number is required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Buyer Identification",
  },
  {
    ruleId: "buyer.address.valid",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ scenario }) => !isGeneralPublic(scenario),
    validate: ({ buyer, referenceData, asOfDate }) => {
      const address = buyer?.billingAddress;
      if (!address) return [{}];
      const countryCode = countryAliases[address.countryCode];
      const failures = !countryCode || !referenceData.isActive("country", countryCode, asOfDate)
        ? [{ fieldPath: "buyer.billingAddress.countryCode", message: "Buyer country is not available in current MyInvois reference data." }]
        : [];
      if (address.countryCode === "MY" && (!address.stateCode || !referenceData.isActive("state", address.stateCode, asOfDate) || address.stateCode === "17")) {
        failures.push({ fieldPath: "buyer.billingAddress.stateCode", message: "Malaysian buyer requires an active state code from 01 to 16; state 17 is reserved for consolidated or non-Malaysian addresses." });
      }
      return failures;
    },
    fieldPath: "buyer.billingAddress",
    message: "Buyer address is required and must use active country/state codes.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Address",
  },
];

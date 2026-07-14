import { describe, expect, it } from "vitest";
import {
  businessDomainSchema,
  decimalStringSchema,
  isoDateSchema,
  isoDateTimeSchema,
  localTimeSchema,
  moneyValueSchema,
  partySchema,
  registrationIdentifierSchema,
  taxIdentifierSchema,
} from ".";

const auditFields = {
  createdAt: "2026-07-14T08:30:00.000Z",
  updatedAt: "2026-07-14T08:30:00.000Z",
};

describe("domain date contracts", () => {
  it.each(["2026-07-14", "2024-02-29"])("accepts valid ISO date %s", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(true);
  });

  it.each(["2026-02-29", "2026-13-01", "14-07-2026", "2026-7-14"])(
    "rejects invalid ISO date %s",
    (value) => {
      expect(isoDateSchema.safeParse(value).success).toBe(false);
    },
  );

  it("distinguishes timestamps and local times", () => {
    expect(isoDateTimeSchema.safeParse("2026-07-14T16:30:00+08:00").success).toBe(true);
    expect(isoDateTimeSchema.safeParse("2026-07-14 16:30:00").success).toBe(false);
    expect(localTimeSchema.safeParse("16:30").success).toBe(true);
    expect(localTimeSchema.safeParse("24:00").success).toBe(false);
  });
});

describe("decimal-safe money contracts", () => {
  it.each(["0", "12", "12.50", "-0.25", "999999999999999999.99"])(
    "accepts decimal string %s",
    (value) => {
      expect(decimalStringSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each(["", "01.00", ".5", "1.", "1,000.00", "1e3", "NaN"])(
    "rejects malformed decimal string %s",
    (value) => {
      expect(decimalStringSchema.safeParse(value).success).toBe(false);
    },
  );

  it("accepts money with a decimal string and ISO-style currency code", () => {
    expect(moneyValueSchema.parse({ amount: "1250.40", currency: "MYR" })).toEqual({
      amount: "1250.40",
      currency: "MYR",
    });
    expect(moneyValueSchema.safeParse({ amount: 1250.4, currency: "MYR" }).success).toBe(false);
    expect(moneyValueSchema.safeParse({ amount: "10.00", currency: "myr" }).success).toBe(false);
  });
});

describe("party contracts", () => {
  it("accepts a Malaysian business party with structured identifiers", () => {
    const result = partySchema.safeParse({
      id: "party_kedai_murni",
      kind: "business",
      legalName: "Kedai Murni Sdn. Bhd.",
      tradingName: "Kedai Murni",
      roles: ["customer", "buyer"],
      taxIdentifiers: [{ scheme: "tin", value: "C2584563202", issuingCountryCode: "MY" }],
      registrationIdentifiers: [
        { scheme: "brn", value: "202301012345", issuingCountryCode: "MY" },
      ],
      email: "accounts@kedaimurni.example",
      billingAddress: {
        addressLines: ["12 Jalan Murni"],
        city: "Shah Alam",
        postcode: "40100",
        stateCode: "10",
        countryCode: "MY",
      },
      defaultCurrency: "MYR",
      defaultPaymentTermsDays: 30,
      ...auditFields,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a foreign party without assuming Malaysian registration", () => {
    const result = partySchema.safeParse({
      id: "party_foreign_supplier",
      kind: "foreign_entity",
      legalName: "Example Trading Pte. Ltd.",
      roles: ["supplier"],
      taxIdentifiers: [{ scheme: "tin", value: "SG-TAX-9001", issuingCountryCode: "SG" }],
      registrationIdentifiers: [
        { scheme: "other", value: "UEN-20260001", issuingCountryCode: "SG", description: "UEN" },
      ],
      billingAddress: {
        addressLines: ["1 Market Street"],
        city: "Singapore",
        postcode: "048946",
        countryCode: "SG",
      },
      defaultCurrency: "SGD",
      ...auditFields,
    });

    expect(result.success).toBe(true);
  });

  it("rejects ambiguous and malformed identifiers", () => {
    expect(registrationIdentifierSchema.safeParse({ scheme: "registration", value: "123" }).success).toBe(false);
    expect(registrationIdentifierSchema.safeParse({ scheme: "other", value: "123" }).success).toBe(false);
    expect(taxIdentifierSchema.safeParse({ scheme: "tin", value: "<unknown>" }).success).toBe(false);
    expect(taxIdentifierSchema.safeParse({ scheme: "tin", value: "" }).success).toBe(false);
  });
});

describe("business contracts", () => {
  const validBusiness = {
    id: "business_warung_kak_lina",
    legalName: "Lina Binti Ahmad",
    tradingName: "Warung Kak Lina",
    entityType: "sole_proprietorship",
    compliance: { sstRegistrations: [] },
    contact: { email: "lina@example.com", phone: "+60123456789" },
    address: {
      addressLines: ["8 Jalan Melur"],
      city: "Kuala Lumpur",
      postcode: "50000",
      stateCode: "14",
      countryCode: "MY",
    },
    defaultCurrency: "MYR",
    preferredLanguage: "ms",
    timezone: "Asia/Kuala_Lumpur",
    ...auditFields,
  };

  it("accepts an onboarding-stage profile with optional compliance fields", () => {
    expect(businessDomainSchema.safeParse(validBusiness).success).toBe(true);
  });

  it("accepts a structured compliance profile and secret references", () => {
    const result = businessDomainSchema.safeParse({
      ...validBusiness,
      compliance: {
        tin: { scheme: "tin", value: "IG56003500070", issuingCountryCode: "MY" },
        registration: { scheme: "brn", value: "202601012345", issuingCountryCode: "MY" },
        sstRegistrations: [{ scheme: "sst", value: "W10-1808-32000001", issuingCountryCode: "MY" }],
        msicCode: "56101",
        businessActivityDescription: "Food and beverage services",
        myInvois: {
          environment: "sandbox",
          clientIdSecretRef: "secret://myinvois/client-id",
          clientSecretSecretRef: "secret://myinvois/client-secret",
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects raw integration credentials and misclassified compliance identifiers", () => {
    expect(
      businessDomainSchema.safeParse({
        ...validBusiness,
        compliance: {
          tin: { scheme: "sst", value: "W10-123" },
          sstRegistrations: [],
          myInvois: {
            environment: "sandbox",
            clientIdSecretRef: "actual-client-id",
            clientSecretSecretRef: "actual-secret",
          },
        },
      }).success,
    ).toBe(false);
  });
});

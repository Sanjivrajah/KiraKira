import { myInvoisReferenceCodeSchema } from "../reference-code.schema";

const metadata = {
  active: true,
  sourceVersion: "myinvois-sdk-2026-07-17",
  syncedAt: "2026-07-17T00:00:00.000Z",
};

const entries = [
  ["classification", "004", "Consolidated e-Invoice"],
  ["classification", "022", "Others"],
  ["classification", "036", "Self-billed - Others"],
  ["country", "MYS", "Malaysia"],
  ["country", "SGP", "Singapore"],
  ["country", "GBR", "United Kingdom"],
  ["currency", "MYR", "Malaysian Ringgit"],
  ["currency", "SGD", "Singapore Dollar"],
  ["currency", "USD", "US Dollar"],
  ["invoice_type", "01", "Invoice"],
  ["invoice_type", "02", "Credit Note"],
  ["invoice_type", "03", "Debit Note"],
  ["invoice_type", "04", "Refund Note"],
  ["invoice_type", "11", "Self-billed Invoice"],
  ["invoice_type", "12", "Self-billed Credit Note"],
  ["invoice_type", "13", "Self-billed Debit Note"],
  ["invoice_type", "14", "Self-billed Refund Note"],
  ["msic", "00000", "Not Applicable"],
  ["msic", "01111", "Growing of maize"],
  ["payment_mode", "01", "Cash"],
  ["payment_mode", "03", "Bank Transfer"],
  ["state", "10", "Selangor"],
  ["state", "14", "Wilayah Persekutuan Kuala Lumpur"],
  ["state", "17", "Not Applicable"],
  ["tax_type", "01", "Sales Tax"],
  ["tax_type", "02", "Service Tax"],
  ["tax_type", "06", "Not Applicable"],
  ["tax_type", "E", "Tax exemption"],
  ["unit_of_measurement", "C62", "one"],
  ["unit_of_measurement", "KGM", "kilogram"],
] as const;

export const MYINVOIS_DEVELOPMENT_REFERENCE_CODES = Object.freeze(
  entries.map(([codeSet, code, description]) => myInvoisReferenceCodeSchema.parse({
    codeSet,
    code,
    description,
    ...metadata,
  })),
);

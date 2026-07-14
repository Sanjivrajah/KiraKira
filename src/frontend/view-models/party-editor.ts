import { z } from "zod";
import { partySchema, type Party } from "@/domain";

export const partyEditorViewModelSchema = z.object({
  id: z.string().trim(),
  kind: z.enum(["business", "individual", "government_entity", "foreign_entity", "general_public"]),
  legalName: z.string().trim().min(2, "Enter the buyer legal name.").max(200),
  tin: z.string().trim().max(50),
  registrationScheme: z.enum(["brn", "nric", "passport", "army_number", "other"]),
  registrationValue: z.string().trim().max(50),
  email: z.string().trim().refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email."),
  phone: z.string().trim().max(30),
  addressLine1: z.string().trim().max(150),
  addressLine2: z.string().trim().max(150),
  city: z.string().trim().max(100),
  postcode: z.string().trim().max(20),
  stateCode: z.string().trim().max(20),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/, "Use a two-letter country code."),
});

export type PartyEditorViewModel = z.infer<typeof partyEditorViewModelSchema>;

export const GENERAL_PUBLIC_PARTY_VIEW_MODEL: PartyEditorViewModel = {
  id: "party_general_public",
  kind: "general_public",
  legalName: "General Public",
  tin: "EI00000000010",
  registrationScheme: "brn",
  registrationValue: "NA",
  email: "",
  phone: "",
  addressLine1: "Not Applicable",
  addressLine2: "",
  city: "Not Applicable",
  postcode: "",
  stateCode: "17",
  countryCode: "MY",
};

export function partyEditorToDomain(input: PartyEditorViewModel, metadata: { id?: string; now: string }): Party {
  const values = partyEditorViewModelSchema.parse(input);
  const generalPublic = values.kind === "general_public";
  if (!generalPublic && (!values.tin || !values.registrationValue || !values.addressLine1 || !values.city)) {
    throw new Error("Buyer tax identity and address are incomplete.");
  }
  return partySchema.parse({
    id: metadata.id || values.id || `party_${Date.now()}`,
    kind: values.kind,
    legalName: values.legalName,
    roles: ["buyer", "customer"],
    taxIdentifiers: values.tin ? [{ scheme: "tin", value: values.tin, issuingCountryCode: values.countryCode }] : [],
    registrationIdentifiers: values.registrationValue ? [{
      scheme: values.registrationScheme,
      value: values.registrationValue,
      issuingCountryCode: values.countryCode,
      ...(values.registrationScheme === "other" ? { description: "Other registration" } : {}),
    }] : [],
    ...(values.email ? { email: values.email } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    billingAddress: {
      addressLines: [values.addressLine1 || "Not Applicable", values.addressLine2].filter(Boolean),
      city: values.city || "Not Applicable",
      ...(values.postcode ? { postcode: values.postcode } : {}),
      stateCode: values.stateCode || "17",
      countryCode: values.countryCode,
    },
    createdAt: metadata.now,
    updatedAt: metadata.now,
  });
}

export function partyDomainToEditor(party: Party): PartyEditorViewModel {
  const tin = party.taxIdentifiers.find((identifier) => identifier.scheme === "tin")?.value ?? "";
  const registration = party.registrationIdentifiers[0];
  return {
    id: party.id,
    kind: party.kind,
    legalName: party.legalName,
    tin,
    registrationScheme: registration?.scheme ?? "brn",
    registrationValue: registration?.value ?? "",
    email: party.email ?? "",
    phone: party.phone ?? "",
    addressLine1: party.billingAddress?.addressLines[0] ?? "",
    addressLine2: party.billingAddress?.addressLines[1] ?? "",
    city: party.billingAddress?.city ?? "",
    postcode: party.billingAddress?.postcode ?? "",
    stateCode: party.billingAddress?.stateCode ?? "17",
    countryCode: party.billingAddress?.countryCode ?? "MY",
  };
}


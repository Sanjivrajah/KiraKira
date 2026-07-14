import { z } from "zod";
import { businessDomainSchema, type Business } from "@/domain";

const optionalText = (maximum: number) => z.string().trim().max(maximum);

export const businessOnboardingViewModelSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the legal business name.").max(200),
  tradingName: optionalText(200),
  businessType: z.enum(["food_beverage", "retail", "services", "online_seller", "other"]),
  entityType: z.enum([
    "sole_proprietorship", "partnership", "limited_liability_partnership", "private_limited_company",
    "public_limited_company", "association", "government_entity", "individual", "foreign_entity", "other",
  ]),
  preferredLanguage: z.enum(["en", "ms"]),
  registrationScheme: z.enum(["brn", "nric", "passport", "army_number", "other"]),
  registrationNumber: optionalText(50),
  tin: optionalText(50),
  sstRegistration: optionalText(50),
  msicCode: z.string().trim().refine((value) => !value || /^\d{5}$/.test(value), "Use a five-digit MSIC code."),
  businessActivityDescription: optionalText(300),
  addressLine1: optionalText(150),
  addressLine2: optionalText(150),
  city: optionalText(100),
  postcode: optionalText(20),
  stateCode: optionalText(20),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/, "Use a two-letter country code."),
  email: z.string().trim().refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email."),
  phone: optionalText(30),
});

export type BusinessOnboardingViewModel = z.infer<typeof businessOnboardingViewModelSchema>;

export const EMPTY_BUSINESS_ONBOARDING: BusinessOnboardingViewModel = {
  legalName: "",
  tradingName: "",
  businessType: "other",
  entityType: "sole_proprietorship",
  preferredLanguage: "en",
  registrationScheme: "brn",
  registrationNumber: "",
  tin: "",
  sstRegistration: "",
  msicCode: "",
  businessActivityDescription: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  stateCode: "17",
  countryCode: "MY",
  email: "",
  phone: "",
};

export function businessOnboardingToDomain(input: BusinessOnboardingViewModel, metadata: {
  id: string;
  now: string;
  createdAt?: string;
}): Business {
  const values = businessOnboardingViewModelSchema.parse(input);
  if (!values.addressLine1 || !values.city) {
    throw new Error("Business address is incomplete.");
  }
  return businessDomainSchema.parse({
    id: metadata.id,
    legalName: values.legalName,
    ...(values.tradingName ? { tradingName: values.tradingName } : {}),
    entityType: values.entityType,
    compliance: {
      ...(values.tin ? { tin: { scheme: "tin", value: values.tin, issuingCountryCode: values.countryCode } } : {}),
      ...(values.registrationNumber ? {
        registration: {
          scheme: values.registrationScheme,
          value: values.registrationNumber,
          issuingCountryCode: values.countryCode,
          ...(values.registrationScheme === "other" ? { description: "Other registration" } : {}),
        },
      } : {}),
      sstRegistrations: values.sstRegistration
        ? [{ scheme: "sst", value: values.sstRegistration, issuingCountryCode: values.countryCode }]
        : [],
      ...(values.msicCode ? { msicCode: values.msicCode } : {}),
      ...(values.businessActivityDescription ? { businessActivityDescription: values.businessActivityDescription } : {}),
    },
    contact: {
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
    },
    address: {
      addressLines: [values.addressLine1, values.addressLine2].filter(Boolean),
      city: values.city,
      ...(values.postcode ? { postcode: values.postcode } : {}),
      ...(values.stateCode ? { stateCode: values.stateCode } : {}),
      countryCode: values.countryCode,
    },
    defaultCurrency: "MYR",
    preferredLanguage: values.preferredLanguage,
    timezone: "Asia/Kuala_Lumpur",
    createdAt: metadata.createdAt ?? metadata.now,
    updatedAt: metadata.now,
  });
}


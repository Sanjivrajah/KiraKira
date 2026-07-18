"use client";

import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { MALAYSIA_ADDRESS_STATE_OPTIONS } from "@/compliance/myinvois/reference-data/malaysia-states";
import type { BusinessOnboardingViewModel } from "@/frontend/view-models";

const businessTypes = [
  { value: "food_beverage", label: "Food & beverage" },
  { value: "retail", label: "Retail" },
  { value: "services", label: "Services" },
  { value: "online_seller", label: "Online seller" },
  { value: "other", label: "Other" },
];
const entityTypes = [
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "limited_liability_partnership", label: "Limited liability partnership" },
  { value: "private_limited_company", label: "Private limited company" },
  { value: "individual", label: "Individual" },
  { value: "other", label: "Other" },
];

export function StagedBusinessForm({ step, values, onChange, onBack, onNext }: {
  step: 1 | 2 | 3;
  values: BusinessOnboardingViewModel;
  onChange: (values: BusinessOnboardingViewModel) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const field = (name: keyof BusinessOnboardingViewModel) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...values, [name]: event.target.value }),
  });
  const valid = step === 1
    ? values.legalName.trim().length >= 2
    : step === 2
      ? Boolean(values.addressLine1.trim() && values.city.trim() && (values.countryCode !== "MY" || values.stateCode) && (values.email.trim() || values.phone.trim()))
      : true;
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (valid) onNext(); }}>
      {step === 1 ? <div className="form-grid">
        <FormField autoComplete="organization" label="Legal business name" required {...field("legalName")} />
        <FormField autoComplete="organization" hint="Optional customer-facing name." label="Trading name" {...field("tradingName")} />
        <SelectField label="Business type" options={businessTypes} {...field("businessType")} />
        <SelectField label="Entity type" options={entityTypes} {...field("entityType")} />
        <SelectField label="Preferred language" options={[{ value: "en", label: "English" }, { value: "ms", label: "Bahasa Malaysia" }]} {...field("preferredLanguage")} />
      </div> : null}
      {step === 2 ? <div className="form-grid">
        <FormField autoComplete="street-address" label="Address line 1" required {...field("addressLine1")} />
        <FormField label="Address line 2" {...field("addressLine2")} />
        <FormField autoComplete="address-level2" label="City" required {...field("city")} />
        <FormField autoComplete="postal-code" label="Postcode" {...field("postcode")} />
        <SelectField label="State" required={values.countryCode === "MY"} options={[{ value: "", label: "Choose a state" }, ...MALAYSIA_ADDRESS_STATE_OPTIONS]} {...field("stateCode")} />
        <FormField label="Country code" maxLength={2} {...field("countryCode")} />
        <FormField autoComplete="email" label="Business email" type="email" {...field("email")} />
        <FormField autoComplete="tel" label="Business phone" {...field("phone")} />
      </div> : null}
      {step === 3 ? <div className="form-grid">
        <SelectField label="Registration type" options={[{ value: "brn", label: "Business registration number" }, { value: "nric", label: "NRIC" }, { value: "passport", label: "Passport" }, { value: "army_number", label: "Army number" }, { value: "other", label: "Other" }]} {...field("registrationScheme")} />
        <FormField hint="Optional during initial setup." label="Registration number" {...field("registrationNumber")} />
        <FormField hint="Optional now; required before many MyInvois scenarios." label="TIN" {...field("tin")} />
        <FormField hint="Optional." label="SST registration" {...field("sstRegistration")} />
        <FormField hint="Five digits, optional during setup." label="MSIC code" inputMode="numeric" maxLength={5} {...field("msicCode")} />
        <FormField label="Business activity description" {...field("businessActivityDescription")} />
      </div> : null}
      {!valid ? <p className="field-error" role="alert">Complete the required fields before continuing.</p> : null}
      <div className="onboarding-actions split">
        {onBack ? <button className="button button-secondary" onClick={onBack} type="button">Back</button> : <span />}
        <button className="button button-primary" disabled={!valid} type="submit">Continue</button>
      </div>
    </form>
  );
}

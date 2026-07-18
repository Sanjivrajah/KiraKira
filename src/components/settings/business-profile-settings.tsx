"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Pencil } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { MALAYSIA_ADDRESS_STATE_OPTIONS, normalizeMalaysiaStateCode } from "@/compliance/myinvois/reference-data/malaysia-states";
import { useUpdateBusinessCompliance } from "@/hooks/use-business";
import { maskSensitiveIdentifier } from "@/lib/privacy/mask-sensitive-identifier";
import type { Business } from "@/types";

interface BusinessProfileSettingsProps {
  business: Business;
}

type FieldErrors = Partial<Record<"legalName" | "tin" | "registrationNumber" | "msicCode" | "businessActivityDescription" | "phone" | "addressLine1" | "city" | "stateCode" | "countryCode", string>>;

function businessValues(business: Business) {
  return {
    legalName: business.legalName ?? business.name,
    tin: business.tin ?? "",
    registrationScheme: business.registrationScheme ?? "brn",
    registrationNumber: business.registrationNumber ?? "",
    email: business.email ?? "",
    msicCode: business.msicCode ?? "",
    businessActivityDescription: business.businessActivityDescription ?? "",
    phone: business.phone ?? "",
    addressLine1: business.addressLine1 ?? "",
    addressLine2: business.addressLine2 ?? "",
    city: business.city ?? "",
    postcode: business.postcode ?? "",
    stateCode: normalizeMalaysiaStateCode(business.stateCode),
    countryCode: business.countryCode ?? "MY",
  };
}

function displayValue(value: string | undefined) {
  return value?.trim() || "Not provided";
}

export function BusinessProfileSettings({ business }: BusinessProfileSettingsProps) {
  const update = useUpdateBusinessCompliance();
  const [values, setValues] = useState(() => businessValues(business));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const set = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaved(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (values.legalName.trim().length < 2) nextErrors.legalName = "Enter the supplier legal name.";
    if (!values.tin.trim()) nextErrors.tin = "Enter the supplier TIN.";
    if (!values.registrationNumber.trim()) nextErrors.registrationNumber = "Enter the supplier registration or identification number.";
    if (!/^\d{5}$/.test(values.msicCode.trim())) nextErrors.msicCode = "Enter the 5-digit MSIC code.";
    if (values.businessActivityDescription.trim().length < 2) nextErrors.businessActivityDescription = "Describe the business activity.";
    if (values.phone.trim().length < 5) nextErrors.phone = "Enter a valid business phone number.";
    if (!values.addressLine1.trim()) nextErrors.addressLine1 = "Enter the registered address.";
    if (!values.city.trim()) nextErrors.city = "Enter the city.";
    if (!/^[A-Za-z]{2}$/.test(values.countryCode.trim())) nextErrors.countryCode = "Use a 2-letter country code.";
    if (values.countryCode.trim().toUpperCase() === "MY" && !MALAYSIA_ADDRESS_STATE_OPTIONS.some((option) => option.value === values.stateCode)) {
      nextErrors.stateCode = "Choose the Malaysian state for this registered address.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await update.mutateAsync({
        businessId: business.id,
        legalName: values.legalName.trim(),
        tin: values.tin.trim(),
        registrationScheme: values.registrationScheme,
        registrationNumber: values.registrationNumber.trim(),
        email: values.email.trim() || undefined,
        msicCode: values.msicCode.trim(),
        businessActivityDescription: values.businessActivityDescription.trim(),
        phone: values.phone.trim(),
        addressLine1: values.addressLine1.trim(),
        addressLine2: values.addressLine2.trim() || undefined,
        city: values.city.trim(),
        postcode: values.postcode.trim() || undefined,
        stateCode: values.stateCode.trim() || undefined,
        countryCode: values.countryCode.trim().toUpperCase(),
      });
      setSaved(true);
      setIsEditing(false);
    } catch {
      setSaved(false);
    }
  };

  const startEditing = () => {
    setValues(businessValues(business));
    setErrors({});
    setSaved(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setValues(businessValues(business));
    setErrors({});
    setIsEditing(false);
  };

  return (
    <section className="settings-card settings-business-card" id="business-profile" aria-labelledby="business-details-title">
      <div className="settings-card-icon" aria-hidden="true"><Building2 size={20} /></div>
      <div className="settings-card-content">
        <div className="settings-card-heading">
          <div>
            <p className="section-kicker">Business profile</p>
            <h2 id="business-details-title">{business.name}</h2>
          </div>
          <span className="settings-status settings-status-ready">{isEditing ? "Editing" : "Saved details"}</span>
        </div>
        <p>These reusable supplier details are included in each e-Invoice preparation snapshot.</p>
        {isEditing ? <form className="settings-business-form" onSubmit={submit} noValidate>
          <div className="settings-business-form-grid">
            <FormField className="settings-business-wide" label="Supplier legal name (required)" name="legalName" required value={values.legalName} error={errors.legalName} onChange={(event) => set("legalName", event.target.value)} />
            <FormField label="Supplier TIN (required)" name="tin" required value={values.tin} error={errors.tin} onChange={(event) => set("tin", event.target.value)} />
            <SelectField label="Registration type (required)" name="registrationScheme" required value={values.registrationScheme} options={[{ value: "brn", label: "BRN" }, { value: "nric", label: "NRIC" }, { value: "passport", label: "Passport" }, { value: "army_number", label: "Army number" }, { value: "other", label: "Other" }]} onChange={(event) => set("registrationScheme", event.target.value)} />
            <FormField label="Registration number (required)" name="registrationNumber" required value={values.registrationNumber} error={errors.registrationNumber} onChange={(event) => set("registrationNumber", event.target.value)} />
            <FormField label="Business email (optional)" name="email" type="email" value={values.email} onChange={(event) => set("email", event.target.value)} />
            <FormField label="MSIC code (required)" name="msicCode" inputMode="numeric" maxLength={5} required value={values.msicCode} error={errors.msicCode} hint="The 5-digit Malaysia Standard Industrial Classification code." onChange={(event) => set("msicCode", event.target.value)} />
            <FormField label="Business phone (required)" name="phone" type="tel" required value={values.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} />
            <FormField className="settings-business-wide" label="Business activity description (required)" name="businessActivityDescription" maxLength={300} required value={values.businessActivityDescription} error={errors.businessActivityDescription} onChange={(event) => set("businessActivityDescription", event.target.value)} />
            <FormField className="settings-business-wide" label="Registered address line 1 (required)" name="addressLine1" required value={values.addressLine1} error={errors.addressLine1} onChange={(event) => set("addressLine1", event.target.value)} />
            <FormField className="settings-business-wide" label="Address line 2 (optional)" name="addressLine2" value={values.addressLine2} onChange={(event) => set("addressLine2", event.target.value)} />
            <FormField label="City (required)" name="city" required value={values.city} error={errors.city} onChange={(event) => set("city", event.target.value)} />
            <FormField label="Postcode (optional)" name="postcode" value={values.postcode} onChange={(event) => set("postcode", event.target.value)} />
            <SelectField label="State (required)" name="stateCode" required value={values.stateCode} error={errors.stateCode} hint="The official MyInvois state code is saved with the address." options={[{ value: "", label: "Choose a state" }, ...MALAYSIA_ADDRESS_STATE_OPTIONS]} onChange={(event) => set("stateCode", event.target.value)} />
            <FormField label="Country code (required)" name="countryCode" maxLength={2} required value={values.countryCode} error={errors.countryCode} hint="Use the ISO 2-letter code, such as MY." onChange={(event) => set("countryCode", event.target.value)} />
          </div>
          {update.isError ? <p className="settings-error" role="alert">{update.error instanceof Error ? update.error.message : "Business details could not be saved."}</p> : null}
          {saved ? <div className="settings-profile-success" role="status"><CheckCircle2 aria-hidden="true" size={18} /><span>Business details saved. <Link href="/e-invoices">Return to e-Invoice preparation</Link> and prepare the invoice again to refresh its checks.</span></div> : null}
          <div className="settings-business-actions">
            <button className="button button-secondary" disabled={update.isPending} type="button" onClick={cancelEditing}>Cancel</button>
            <button className="button button-primary" disabled={update.isPending} type="submit">{update.isPending ? "Saving…" : "Save changes"}</button>
          </div>
        </form> : <>
          {saved ? <div className="settings-profile-success" role="status"><CheckCircle2 aria-hidden="true" size={18} /><span>Business details saved. <Link href="/e-invoices">Return to e-Invoice preparation</Link> and prepare the invoice again to refresh its checks.</span></div> : null}
          <dl className="settings-business-summary">
            <div className="settings-business-summary-wide"><dt>Supplier legal name</dt><dd>{displayValue(values.legalName)}</dd></div>
            <div><dt>Supplier TIN</dt><dd>{maskSensitiveIdentifier(values.tin)}</dd></div>
            <div><dt>Registration</dt><dd>{displayValue(values.registrationScheme).toUpperCase()} · {values.registrationScheme === "nric" ? maskSensitiveIdentifier(values.registrationNumber) : displayValue(values.registrationNumber)}</dd></div>
            <div><dt>Business email</dt><dd>{displayValue(values.email)}</dd></div>
            <div><dt>MSIC code</dt><dd>{displayValue(values.msicCode)}</dd></div>
            <div className="settings-business-summary-wide"><dt>Business activity</dt><dd>{displayValue(values.businessActivityDescription)}</dd></div>
            <div><dt>Business phone</dt><dd>{displayValue(values.phone)}</dd></div>
            <div><dt>Registered address</dt><dd>{[values.addressLine1, values.addressLine2, values.postcode, values.city, values.stateCode, values.countryCode].filter(Boolean).join(", ") || "Not provided"}</dd></div>
          </dl>
          <div className="settings-business-actions"><button className="button button-primary" type="button" onClick={startEditing}><Pencil aria-hidden="true" size={16} />Edit business details</button></div>
        </>}
      </div>
    </section>
  );
}

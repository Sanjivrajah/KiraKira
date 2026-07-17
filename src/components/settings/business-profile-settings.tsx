"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { useUpdateBusinessCompliance } from "@/hooks/use-business";
import type { Business } from "@/types";

interface BusinessProfileSettingsProps {
  business: Business;
}

type FieldErrors = Partial<Record<"msicCode" | "businessActivityDescription" | "phone" | "addressLine1" | "city" | "countryCode", string>>;

export function BusinessProfileSettings({ business }: BusinessProfileSettingsProps) {
  const update = useUpdateBusinessCompliance();
  const [values, setValues] = useState({
    msicCode: business.msicCode ?? "",
    businessActivityDescription: business.businessActivityDescription ?? "",
    phone: business.phone ?? "",
    addressLine1: business.addressLine1 ?? "",
    addressLine2: business.addressLine2 ?? "",
    city: business.city ?? "",
    postcode: business.postcode ?? "",
    stateCode: business.stateCode ?? "",
    countryCode: business.countryCode ?? "MY",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  const set = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaved(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!/^\d{5}$/.test(values.msicCode.trim())) nextErrors.msicCode = "Enter the 5-digit MSIC code.";
    if (values.businessActivityDescription.trim().length < 2) nextErrors.businessActivityDescription = "Describe the business activity.";
    if (values.phone.trim().length < 5) nextErrors.phone = "Enter a valid business phone number.";
    if (!values.addressLine1.trim()) nextErrors.addressLine1 = "Enter the registered address.";
    if (!values.city.trim()) nextErrors.city = "Enter the city.";
    if (!/^[A-Za-z]{2}$/.test(values.countryCode.trim())) nextErrors.countryCode = "Use a 2-letter country code.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await update.mutateAsync({
        businessId: business.id,
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
    } catch {
      setSaved(false);
    }
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
          <span className="settings-status settings-status-ready">Editable</span>
        </div>
        <p>These reusable supplier details are included in each e-Invoice preparation snapshot.</p>
        <form className="settings-business-form" onSubmit={submit} noValidate>
          <div className="settings-business-form-grid">
            <FormField label="MSIC code" name="msicCode" inputMode="numeric" maxLength={5} value={values.msicCode} error={errors.msicCode} hint="The 5-digit Malaysia Standard Industrial Classification code." onChange={(event) => set("msicCode", event.target.value)} />
            <FormField label="Business phone" name="phone" type="tel" value={values.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} />
            <FormField className="settings-business-wide" label="Business activity description" name="businessActivityDescription" maxLength={300} value={values.businessActivityDescription} error={errors.businessActivityDescription} onChange={(event) => set("businessActivityDescription", event.target.value)} />
            <FormField className="settings-business-wide" label="Registered address line 1" name="addressLine1" value={values.addressLine1} error={errors.addressLine1} onChange={(event) => set("addressLine1", event.target.value)} />
            <FormField className="settings-business-wide" label="Address line 2 (optional)" name="addressLine2" value={values.addressLine2} onChange={(event) => set("addressLine2", event.target.value)} />
            <FormField label="City" name="city" value={values.city} error={errors.city} onChange={(event) => set("city", event.target.value)} />
            <FormField label="Postcode (optional)" name="postcode" value={values.postcode} onChange={(event) => set("postcode", event.target.value)} />
            <FormField label="State code (optional)" name="stateCode" value={values.stateCode} hint="For example, 14 for Kuala Lumpur." onChange={(event) => set("stateCode", event.target.value)} />
            <FormField label="Country code" name="countryCode" maxLength={2} value={values.countryCode} error={errors.countryCode} hint="Use the ISO 2-letter code, such as MY." onChange={(event) => set("countryCode", event.target.value)} />
          </div>
          {update.isError ? <p className="settings-error" role="alert">{update.error instanceof Error ? update.error.message : "Business details could not be saved."}</p> : null}
          {saved ? <div className="settings-profile-success" role="status"><CheckCircle2 aria-hidden="true" size={18} /><span>Business details saved. <Link href="/e-invoices">Return to e-Invoice preparation</Link> and prepare the invoice again to refresh its checks.</span></div> : null}
          <div className="settings-business-actions"><button className="button button-primary" disabled={update.isPending} type="submit">{update.isPending ? "Saving…" : "Save business details"}</button></div>
        </form>
      </div>
    </section>
  );
}

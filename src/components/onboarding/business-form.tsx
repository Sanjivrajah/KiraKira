"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { businessSchema, type BusinessFormValues } from "@/lib/validation/business";
import { DEMO_BUSINESS } from "@/data/demo";
import type { BusinessInput } from "@/types";

const businessTypes = [
  { value: "", label: "Choose a business type" },
  { value: "food_beverage", label: "Food & beverage" },
  { value: "retail", label: "Retail" },
  { value: "services", label: "Services" },
  { value: "online_seller", label: "Online seller" },
  { value: "other", label: "Other" },
];

export function BusinessForm({ initialValues, onReview }: {
  initialValues?: BusinessInput | null;
  onReview: (business: BusinessInput) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: initialValues ?? {
      name: "",
      type: undefined,
      registrationNumber: "",
      tin: "",
      currency: "MYR",
      preferredLanguage: "en",
    },
  });

  return (
    <form className="business-form" noValidate onSubmit={handleSubmit((values) => onReview(businessSchema.parse(values)))}>
      <div className="form-grid">
        <FormField
          autoComplete="organization"
          error={errors.name?.message}
          label="Business name"
          maxLength={100}
          placeholder={`e.g. ${DEMO_BUSINESS.name}`}
          {...register("name")}
        />
        <SelectField
          error={errors.type?.message}
          label="Business type"
          options={businessTypes}
          {...register("type")}
        />
        <FormField
          error={errors.registrationNumber?.message}
          hint="Recommended — you can add this later."
          label="Registration number"
          maxLength={30}
          {...register("registrationNumber")}
        />
        <FormField
          error={errors.tin?.message}
          hint="Recommended for future e-invoicing readiness."
          label="Tax identification number (TIN)"
          maxLength={20}
          {...register("tin")}
        />
        <FormField label="Currency" readOnly value="MYR — Malaysian ringgit" />
        <input type="hidden" value="MYR" {...register("currency")} />
        <SelectField
          error={errors.preferredLanguage?.message}
          hint="The full interface remains in English in this phase."
          label="Preferred language"
          options={[
            { value: "en", label: "English" },
            { value: "ms", label: "Bahasa Malaysia" },
          ]}
          {...register("preferredLanguage")}
        />
      </div>
      <div className="onboarding-actions">
        <button className="button button-primary" type="submit">Review details</button>
      </div>
    </form>
  );
}

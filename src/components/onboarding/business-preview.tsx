import type { BusinessInput, BusinessType } from "@/types";

const typeLabels: Record<BusinessType, string> = {
  food_beverage: "Food & beverage",
  retail: "Retail",
  services: "Services",
  online_seller: "Online seller",
  other: "Other",
};

export const businessTypeLabels = typeLabels;

export function BusinessPreview({ business, onEdit, onComplete }: {
  business: BusinessInput;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const details = [
    ["Business name", business.name],
    ["Business type", typeLabels[business.type]],
    ["Registration number", business.registrationNumber || "Not provided"],
    ["TIN", business.tin || "Not provided"],
    ["Currency", "MYR — Malaysian ringgit"],
    ["Preferred language", business.preferredLanguage === "ms" ? "Bahasa Malaysia" : "English"],
  ];
  return (
    <div>
      <dl className="business-preview">
        {details.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <p className="review-note" aria-live="polite">Your details are ready to save to this browser.</p>
      <div className="onboarding-actions split">
        <button className="button button-secondary" onClick={onEdit} type="button">Edit details</button>
        <button className="button button-primary" onClick={onComplete} type="button">Complete setup</button>
      </div>
    </div>
  );
}

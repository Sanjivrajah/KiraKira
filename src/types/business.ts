export type BusinessType =
  | "food_beverage"
  | "retail"
  | "services"
  | "online_seller"
  | "other";

export type PreferredLanguage = "en" | "ms";

export interface BusinessProfile {
  name: string;
  type: BusinessType;
  registrationNumber: string;
  tin: string;
  currency: "MYR";
  preferredLanguage: PreferredLanguage;
}

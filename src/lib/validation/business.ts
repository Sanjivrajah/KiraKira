import { z } from "zod";

const normalizedText = (maximum: number) =>
  z
    .string()
    .max(maximum, `Keep this under ${maximum} characters.`)
    .transform((value) => value.trim().replace(/\s+/g, " "));

export const businessSchema = z.object({
  name: normalizedText(100).pipe(z.string().min(2, "Enter at least 2 characters.")),
  type: z.enum(["food_beverage", "retail", "services", "online_seller", "other"], {
    error: "Choose a business type.",
  }),
  registrationNumber: normalizedText(30),
  tin: normalizedText(20),
  currency: z.literal("MYR"),
  preferredLanguage: z.enum(["en", "ms"], {
    error: "Choose a preferred language.",
  }),
});

export type BusinessFormValues = z.input<typeof businessSchema>;

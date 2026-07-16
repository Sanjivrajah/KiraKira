import { z } from "zod";

const addressTextSchema = (maximum: number) => z.string().trim().min(1).max(maximum);

export const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Use a two-letter uppercase country code.");

export const addressSchema = z
  .object({
    addressLines: z.array(addressTextSchema(150)).min(1).max(3),
    city: addressTextSchema(100),
    postcode: addressTextSchema(20).optional(),
    stateCode: addressTextSchema(20).optional(),
    countryCode: countryCodeSchema,
  })
  .strict()
  .superRefine((address, ctx) => {
    if (address.countryCode === "MY" && !address.stateCode) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State code is required for Malaysian addresses.",
      });
    }
  });


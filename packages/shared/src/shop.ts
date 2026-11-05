import { z } from "zod";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

/**
 * Indian mobile number, accepted as 10 digits with or without +91 / 0 prefix,
 * spaces or dashes. Normalised to E.164 (+91XXXXXXXXXX).
 */
export const IndianMobile = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"))
  .transform((d) => `+91${d}`);

/** GST Identification Number: 15 characters, upper-cased. */
export const Gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || undefined)
    .optional();

export const ShopInput = z.object({
  name: z.string().trim().min(2, "Shop name is too short").max(120),
  legalName: optionalText(200),
  gstin: z
    .string()
    .trim()
    .transform((s) => s || undefined)
    .pipe(Gstin.optional())
    .optional(),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.enum(INDIAN_STATES, { error: "Choose a state" }),
  phone: z
    .string()
    .trim()
    .transform((s) => s || undefined)
    .pipe(IndianMobile.optional())
    .optional(),
});
export type ShopInput = z.infer<typeof ShopInput>;

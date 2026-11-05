import { z } from "zod";

/** BIS Hallmark Unique ID: 6 alphanumeric characters, stored upper-case. */
export const Huid = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "HUID must be 6 letters or digits");

export const Metal = z.enum(["gold", "silver", "platinum", "other"]);

/** Gold purity in karats as hallmarked in India (e.g. 22K916 → 22). */
export const GoldKarat = z.union([
  z.literal(14),
  z.literal(18),
  z.literal(20),
  z.literal(22),
  z.literal(23),
  z.literal(24),
]);

export const GradingLab = z.enum(["GIA", "IGI", "HRD", "SGL", "other"]);

export const GradingReport = z.object({
  lab: GradingLab,
  reportNumber: z.string().trim().min(4).max(32),
});

export const JewelleryItemInput = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    metal: Metal,
    karat: GoldKarat.optional(),
    grossWeightGrams: z.number().positive().max(10_000),
    netWeightGrams: z.number().positive().max(10_000).optional(),
    huids: z.array(Huid).max(20).default([]),
    gradingReports: z.array(GradingReport).max(20).default([]),
    /** Kept private to the shop; never shown on the public verify page. */
    pricePaise: z.number().int().nonnegative().optional(),
  })
  .refine((i) => i.metal !== "gold" || i.karat !== undefined, {
    message: "Gold items need a karat",
    path: ["karat"],
  })
  .refine((i) => !i.netWeightGrams || i.netWeightGrams <= i.grossWeightGrams, {
    message: "Net weight cannot exceed gross weight",
    path: ["netWeightGrams"],
  });
export type JewelleryItemInput = z.infer<typeof JewelleryItemInput>;

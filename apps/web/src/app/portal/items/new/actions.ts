"use server";

import { GradingLab, Huid, JewelleryItemInput } from "@gemledger/shared";
import { z } from "zod";
import { requireMyShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ItemFormInput = {
  title: string;
  description: string;
  metal: string;
  karat: string;
  grossWeight: string;
  netWeight: string;
  priceRupees: string;
  huids: string;
  reportLab: string;
  reportNumber: string;
};

export type CreateItemResult =
  | { ok: true; itemId: string; shopId: string }
  | { ok: false; error?: string; fieldErrors?: Partial<Record<keyof ItemFormInput, string>> };

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Split "AB12CD, ef34gh xy56zz" into HUIDs. */
function splitHuids(raw: string) {
  return raw.split(/[\s,;]+/).filter(Boolean);
}

export async function createItem(input: ItemFormInput): Promise<CreateItemResult> {
  const shop = await requireMyShop();
  const fieldErrors: NonNullable<Extract<CreateItemResult, { ok: false }>["fieldErrors"]> = {};

  const huids: string[] = [];
  for (const h of splitHuids(input.huids)) {
    const r = Huid.safeParse(h);
    if (r.success) huids.push(r.data);
    else fieldErrors.huids ??= `"${h}" is not a valid HUID (6 letters or digits)`;
  }
  if (new Set(huids).size !== huids.length) fieldErrors.huids ??= "The same HUID is listed twice";

  const reports: { lab: string; report_number: string }[] = [];
  if (input.reportNumber.trim()) {
    const lab = GradingLab.safeParse(input.reportLab);
    const number = z.string().trim().min(4).max(32).safeParse(input.reportNumber);
    if (!lab.success) fieldErrors.reportLab = "Choose the lab";
    if (!number.success) fieldErrors.reportNumber = "Report numbers are 4 to 32 characters";
    if (lab.success && number.success) reports.push({ lab: lab.data, report_number: number.data });
  }

  const price = num(input.priceRupees);
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) fieldErrors.priceRupees = "Enter a price in rupees";

  const parsed = JewelleryItemInput.safeParse({
    title: input.title,
    description: input.description.trim() || undefined,
    metal: input.metal,
    karat: num(input.karat),
    grossWeightGrams: num(input.grossWeight),
    netWeightGrams: num(input.netWeight),
    huids,
  });
  if (!parsed.success) {
    const map: Record<string, keyof ItemFormInput> = {
      title: "title", description: "description", metal: "metal", karat: "karat",
      grossWeightGrams: "grossWeight", netWeightGrams: "netWeight",
    };
    for (const issue of parsed.error.issues) {
      const key = map[String(issue.path[0])];
      if (key) fieldErrors[key] ??= issue.message;
    }
  }
  if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const item = parsed.data;
  const supabase = await createClient();
  const { data: itemId, error } = await supabase.rpc("create_item", {
    p_shop_id: shop.id,
    p_title: item.title,
    p_description: item.description ?? null,
    p_metal: item.metal,
    p_karat: item.karat ?? null,
    p_gross_weight_g: item.grossWeightGrams,
    p_net_weight_g: item.netWeightGrams ?? null,
    p_price_paise: price === undefined ? null : Math.round(price * 100),
    p_huids: huids,
    p_reports: reports,
  });
  if (error || !itemId) return { ok: false, error: "We couldn't save this item. Please try again." };
  return { ok: true, itemId, shopId: shop.id };
}

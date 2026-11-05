"use server";

import { ShopInput } from "@gemledger/shared";
import { redirect } from "next/navigation";
import { getMyShop, requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ShopFormState = { error?: string; fieldErrors?: Partial<Record<keyof ShopInput, string>> };

export async function registerShop(_prev: ShopFormState, form: FormData): Promise<ShopFormState> {
  const userId = await requireUserId();
  if (await getMyShop()) redirect("/portal");

  const parsed = ShopInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: ShopFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ShopInput;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("shops").insert({
    name: s.name,
    legal_name: s.legalName ?? null,
    gstin: s.gstin ?? null,
    city: s.city,
    state: s.state,
    phone: s.phone ?? null,
    created_by: userId,
  });
  if (error) return { error: "We couldn't save your shop. Please try again." };
  redirect("/portal");
}

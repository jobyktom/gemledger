"use server";

import { newPublicPassportId } from "@gemledger/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMyShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type IssueResult = { error?: string };

export async function issuePassport(itemId: string): Promise<IssueResult> {
  const id = z.uuid().parse(itemId);
  const shop = await requireMyShop();
  if (shop.status !== "approved") return { error: "Your shop needs to be approved before it can issue passports." };

  const supabase = await createClient();
  // RLS also checks the shop is approved and the item belongs to it; the
  // unique index allows only one live passport per item.
  const { error } = await supabase
    .from("passports")
    .insert({ item_id: id, shop_id: shop.id, public_id: newPublicPassportId() });
  if (error) {
    if (error.code === "23505") return { error: "This item already has a passport." };
    return { error: "We couldn't issue the passport. Please try again." };
  }
  revalidatePath(`/portal/items/${id}`);
  revalidatePath("/portal");
  return {};
}

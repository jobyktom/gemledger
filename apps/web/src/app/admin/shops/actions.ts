"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({
  shopId: z.uuid(),
  status: z.enum(["approved", "suspended", "pending"]),
});

export async function setShopStatus(form: FormData) {
  if (!(await isPlatformAdmin())) throw new Error("Not allowed");
  const { shopId, status } = Input.parse(Object.fromEntries(form));
  const supabase = await createClient();
  // The database also enforces this: only platform admins may change status.
  const { error } = await supabase.from("shops").update({ status }).eq("id", shopId);
  if (error) throw error;
  revalidatePath("/admin", "layout");
}

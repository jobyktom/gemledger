"use server";

import { IndianMobile } from "@gemledger/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/portal/staff/shared";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The database functions also check the caller is a GemLedger admin and, for
// recovery, that they entered a fresh sign-in code.

function fail(error: { message: string; code?: string }): ActionResult {
  if (error.message === "reauth_required") return { reauth: true, error: "Confirm it's you with a fresh sign-in code, then try again." };
  if (error.code === "P0001") return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

/** Recovery: invite a new shop admin when the shop's only admin is locked out. */
export async function inviteShopAdmin(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Not allowed" };
  const shopId = z.uuid().safeParse(form.get("shopId"));
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!shopId.success || !name.success) return { error: "Enter the person's name" };
  const method = form.get("method");
  let phone: string | null = null;
  let email: string | null = null;
  if (method === "phone") {
    const p = IndianMobile.safeParse(form.get("phone") ?? "");
    if (!p.success) return { error: p.error.issues[0]?.message };
    phone = p.data;
  } else {
    const e = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
    if (!e.success) return { error: "Enter a valid email address" };
    email = e.data;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_invite_shop_admin", { p_shop: shopId.data, p_name: name.data, p_phone: phone, p_email: email });
  if (error) return fail(error);
  revalidatePath(`/admin/shops/${shopId.data}`);
  return {
    ok: true,
    notice: `Invited ${name.data} as shop admin. They sign in with that ${phone ? "number" : "email"} and press Accept with a fresh code.`,
  };
}

/** Emergency suspend or reactivate of one person at a shop. */
export async function setMemberStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return { error: "Not allowed" };
  const shopId = z.uuid().safeParse(form.get("shopId"));
  const userId = z.uuid().safeParse(form.get("userId"));
  const status = z.enum(["active", "suspended"]).safeParse(form.get("status"));
  if (!shopId.success || !userId.success || !status.success) return { error: "Something went wrong" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_status", { p_shop: shopId.data, p_user: userId.data, p_status: status.data });
  if (error) return fail(error);
  revalidatePath(`/admin/shops/${shopId.data}`);
  return { ok: true, notice: status.data === "suspended" ? "Suspended." : "Reactivated." };
}

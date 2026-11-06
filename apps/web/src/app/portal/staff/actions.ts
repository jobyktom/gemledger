"use server";

import { IndianMobile } from "@gemledger/shared";
import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMyShop, requireShopAdmin } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ROLE_LABEL, type ShareInfo } from "./shared";

// Every action below is also enforced by the database functions it calls
// (see supabase/migrations/20261106140000_staff_management.sql). The checks
// here only give friendlier messages. The shop always comes from the signed-in
// user's own membership, never from the form.

const Name = z.string().trim().min(1, "Enter the person's name").max(80, "Keep the name under 80 characters");
const UserId = z.uuid();
const Email = z.email("Enter a valid email address").transform((s) => s.trim().toLowerCase());

const Contact = z.discriminatedUnion("method", [
  z.object({ method: z.literal("phone"), phone: IndianMobile }),
  z.object({ method: z.literal("email"), email: Email }),
]);

function fail(error: PostgrestError | null): ActionResult {
  if (!error) return { error: "Something went wrong. Please try again." };
  if (error.message === "reauth_required") {
    return { reauth: true, error: "For your security, confirm it's you with a fresh sign-in code, then try again." };
  }
  if (error.code === "42501") return { error: "You don't have permission to do that." };
  // Our own checks raise plain-English messages (SQLSTATE P0001).
  if (error.code === "P0001") return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

function firstIssue(e: z.ZodError): ActionResult {
  return { error: e.issues[0]?.message ?? "Please check the form" };
}

function refresh() {
  revalidatePath("/portal/staff", "layout");
}

function inviteMessage(shopName: string, name: string, contact: { phone?: string; email?: string }, origin: string) {
  const how = contact.phone ? "this mobile number" : "this email address";
  return (
    `Hi ${name}, ${shopName} has added you to its team on GemLedger. ` +
    `Sign in at ${origin}/login with ${how} to start. ` +
    `You'll get a one-time code: never share it with anyone, including the shop.`
  );
}

export async function inviteStaff(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const name = Name.safeParse(form.get("name"));
  if (!name.success) return firstIssue(name.error);
  const role = z.enum(["staff", "manager", "owner"]).safeParse(form.get("role"));
  if (!role.success) return { error: "Choose a role" };
  const contact = Contact.safeParse({ method: form.get("method"), phone: form.get("phone") ?? "", email: form.get("email") ?? "" });
  if (!contact.success) return firstIssue(contact.error);
  const c = contact.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_invite", {
    p_shop: shop.id,
    p_name: name.data,
    p_role: role.data,
    p_phone: c.method === "phone" ? c.phone : null,
    p_email: c.method === "email" ? c.email : null,
  });
  if (error) return fail(error);
  refresh();

  const target = c.method === "phone" ? { phone: c.phone } : { email: c.email };
  const share: ShareInfo = {
    title: `Let ${name.data} know`,
    ...target,
    text: inviteMessage(shop.name, name.data, target, await siteOrigin()),
  };
  const extra = role.data === "owner" ? " As a shop admin, they'll be asked to accept with a fresh code after signing in." : "";
  return {
    ok: true,
    notice: `${name.data} is invited as ${ROLE_LABEL[role.data].toLowerCase()}. The invitation works for 7 days.${extra}`,
    share: [share],
  };
}

export async function cancelInvite(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireShopAdmin();
  const id = UserId.safeParse(form.get("inviteId"));
  if (!id.success) return { error: "Invitation not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_cancel_invite", { p_invite: id.data });
  if (error) return fail(error);
  refresh();
  return { ok: true, notice: "Invitation cancelled." };
}

export async function renameStaff(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const user = UserId.safeParse(form.get("userId"));
  const name = Name.safeParse(form.get("name"));
  if (!user.success) return { error: "Person not found" };
  if (!name.success) return firstIssue(name.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_rename", { p_shop: shop.id, p_user: user.data, p_name: name.data });
  if (error) return fail(error);
  refresh();
  return { ok: true, notice: "Name saved." };
}

export async function changeRole(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const user = UserId.safeParse(form.get("userId"));
  const role = z.enum(["staff", "manager"]).safeParse(form.get("role"));
  if (!user.success || !role.success) return { error: "Choose a role" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_change_role", { p_shop: shop.id, p_user: user.data, p_role: role.data });
  if (error) return fail(error);
  refresh();
  return { ok: true, notice: `Role changed to ${ROLE_LABEL[role.data].toLowerCase()}.` };
}

export async function offerAdmin(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const user = UserId.safeParse(form.get("userId"));
  if (!user.success) return { error: "Person not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_offer_admin", { p_shop: shop.id, p_user: user.data });
  if (error) return fail(error);
  refresh();
  return {
    ok: true,
    notice: "Offer sent. They become a shop admin once they accept it in GemLedger with a fresh sign-in code.",
  };
}

export async function setStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const user = UserId.safeParse(form.get("userId"));
  const status = z.enum(["active", "suspended", "removed"]).safeParse(form.get("status"));
  if (!user.success || !status.success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_set_status", { p_shop: shop.id, p_user: user.data, p_status: status.data });
  if (error) return fail(error);
  refresh();
  const notice = {
    active: "Access restored.",
    suspended: "Suspended. They can no longer see or change anything in your shop.",
    removed: "Removed from your shop. Their past work stays on record.",
  }[status.data];
  return { ok: true, notice };
}

export async function changeLogin(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const shop = await requireShopAdmin();
  const user = UserId.safeParse(form.get("userId"));
  if (!user.success) return { error: "Person not found" };
  const contact = Contact.safeParse({ method: form.get("method"), phone: form.get("phone") ?? "", email: form.get("email") ?? "" });
  if (!contact.success) return firstIssue(contact.error);
  const c = contact.data;

  const supabase = await createClient();
  const { data: people, error: listError } = await supabase.rpc("staff_list", { p_shop: shop.id });
  if (listError) return fail(listError);
  const person = people?.find((p) => p.user_id === user.data);
  const { error } = await supabase.rpc("staff_change_login", {
    p_shop: shop.id,
    p_user: user.data,
    p_phone: c.method === "phone" ? c.phone : null,
    p_email: c.method === "email" ? c.email : null,
  });
  if (error) return fail(error);
  refresh();

  const name = person?.display_name ?? "there";
  const origin = await siteOrigin();
  const target = c.method === "phone" ? { phone: c.phone } : { email: c.email };
  const share: ShareInfo[] = [
    {
      title: "Tell the new number or email",
      ...target,
      text:
        `Hi ${name}, ${shop.name} has moved your GemLedger sign-in to ${c.method === "phone" ? "this number" : "this email"}. ` +
        `Sign in at ${origin}/login with it to keep working. Never share your sign-in code with anyone.`,
    },
  ];
  const old = person?.contact;
  if (old) {
    share.push({
      title: "Tell the old number or email",
      ...(old.includes("@") ? { email: old } : { phone: old }),
      text:
        `GemLedger: ${shop.name} has replaced this ${old.includes("@") ? "email" : "number"} as the way ${name} signs in. ` +
        `If you didn't expect this, contact the shop or GemLedger support.`,
    });
  }
  return {
    ok: true,
    notice:
      "Change requested. The new number or email must sign in to prove it's theirs. Until then the old one keeps working, " +
      "so suspend them first if the old phone was lost or stolen.",
    share,
  };
}

/** The invitee accepts a shop admin invitation (needs a fresh code). */
export async function acceptInvite(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const id = UserId.safeParse(form.get("inviteId"));
  if (!id.success) return { error: "Invitation not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_staff_invite", { p_invite: id.data });
  if (error) return fail(error);
  revalidatePath("/portal", "layout");
  const shop = await getMyShop();
  return { ok: true, notice: shop ? `You're now a shop admin at ${shop.name}.` : "Accepted." };
}

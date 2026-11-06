import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

/** The signed-in user's id, or a redirect to the login page. */
export const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect("/login");
  return sub;
});

export type MyShop = {
  id: string;
  name: string;
  city: string;
  state: string;
  status: "pending" | "approved" | "suspended";
  role: "owner" | "manager" | "staff";
};

/**
 * The first shop the signed-in user is an active member of (one shop per user
 * for now). Before looking, it accepts any staff invitation sent to the
 * phone or email this user has verified, so invited staff join on sign-in.
 */
export const getMyShop = cache(async (): Promise<MyShop | null> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { error: inviteError } = await supabase.rpc("accept_staff_invites");
  if (inviteError) throw inviteError;
  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shops (id, name, city, state, status)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.shops) return null;
  return { ...data.shops, role: data.role };
});

/** "suspended" or "removed" when the user has no active shop but used to. */
export const getLostAccess = cache(async (): Promise<"suspended" | "removed" | null> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .select("status")
    .eq("user_id", userId)
    .neq("status", "active")
    .order("status_changed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "suspended" || data?.status === "removed" ? data.status : null;
});

/**
 * Seconds since the user last entered a sign-in code or opened a sign-in
 * link. Supabase keeps this in the token's amr claim across refreshes.
 */
export const getSecondsSinceSignIn = cache(async (): Promise<number> => {
  await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims as { amr?: { timestamp?: number }[] } | undefined)?.amr ?? [];
  const latest = Math.max(0, ...amr.map((a) => Number(a.timestamp) || 0));
  return Math.floor(Date.now() / 1000) - latest;
});

/** Staff and managers sign in again after this long, for shared shop counters. */
export const STAFF_SESSION_SECONDS = 12 * 60 * 60;

/** The user's shop, or a redirect to shop registration. */
export async function requireMyShop(): Promise<MyShop> {
  const shop = await getMyShop();
  if (!shop) redirect((await getLostAccess()) ? "/portal/no-access" : "/portal/shop/new");
  return shop;
}

/** The user's shop if they are its admin, otherwise back to the portal. */
export async function requireShopAdmin(): Promise<MyShop> {
  const shop = await requireMyShop();
  if (shop.role !== "owner") redirect("/portal/staff");
  return shop;
}

/** True when the signed-in user is GemLedger staff. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_platform_admin");
  if (error) throw error;
  return data === true;
});

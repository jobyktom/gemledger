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

/** The first shop the signed-in user belongs to (one shop per user for now). */
export const getMyShop = cache(async (): Promise<MyShop | null> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shops (id, name, city, state, status)")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.shops) return null;
  return { ...data.shops, role: data.role };
});

/** The user's shop, or a redirect to shop registration. */
export async function requireMyShop(): Promise<MyShop> {
  const shop = await getMyShop();
  if (!shop) redirect("/portal/shop/new");
  return shop;
}

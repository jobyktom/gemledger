import type { Database } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["shop_role"];
export type MemberStatus = Database["public"]["Enums"]["member_status"];

export const ROLE_LABEL: Record<Role, string> = { owner: "Shop admin", manager: "Manager", staff: "Staff" };
export const STATUS_LABEL: Record<MemberStatus, string> = { active: "Active", suspended: "Suspended", removed: "Removed" };

/** A message the shop admin sends from their own phone (WhatsApp, SMS or email). */
export type ShareInfo = { title: string; phone?: string; email?: string; text: string };

/** What a staff action returns to the form that called it. */
export type ActionResult = { ok?: boolean; error?: string; reauth?: boolean; notice?: string; share?: ShareInfo[] };

export const ACTION_LABEL: Record<string, string> = {
  invited: "Invited",
  invite_cancelled: "Cancelled invitation for",
  joined: "Joined:",
  role_changed: "Changed role of",
  renamed: "Renamed",
  suspended: "Suspended",
  reactivated: "Reactivated",
  removed: "Removed",
  login_change_requested: "Asked to change sign-in for",
  login_changed: "Sign-in changed for",
  admin_offered: "Offered shop admin to",
  admin_accepted: "Became shop admin:",
};

/** "+919876543210" -> "+91 98765 43210"; emails unchanged. */
export function formatContact(contact: string | null | undefined): string {
  if (!contact) return "";
  const m = /^\+?91(\d{5})(\d{5})$/.exec(contact);
  return m ? `+91 ${m[1]} ${m[2]}` : contact;
}

export function personName(p: { display_name: string | null; contact?: string | null }): string {
  return p.display_name ?? (p.contact ? formatContact(p.contact) : "Unnamed");
}

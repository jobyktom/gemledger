import type { Metadata } from "next";
import Link from "next/link";
import { requireShopAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personName } from "../shared";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = { title: "Staff activity · GemLedger" };

export default async function StaffActivityPage() {
  const shop = await requireShopAdmin();
  const supabase = await createClient();
  const [logRes, peopleRes] = await Promise.all([
    supabase
      .from("staff_activity_log")
      .select("id, action, actor_id, by_platform_admin, target_user_id, target_name, details, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("staff_list", { p_shop: shop.id, p_include_removed: true }),
  ]);
  if (logRes.error) throw logRes.error;
  if (peopleRes.error) throw peopleRes.error;
  const names = new Map((peopleRes.data ?? []).map((p) => [p.user_id, personName(p)]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/portal/staff" className="text-sm text-zinc-500 hover:underline">← Staff</Link>
        <h1 className="text-2xl font-semibold">Staff activity</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every change to your shop&apos;s people. Nobody can edit or delete these entries, including shop admins.
        </p>
      </div>
      <ActivityList entries={logRes.data ?? []} names={names} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityList } from "@/app/portal/staff/activity/activity-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff activity · GemLedger admin" };

export default async function AdminStaffActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [shopRes, logRes, membersRes] = await Promise.all([
    supabase.from("shops").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("staff_activity_log")
      .select("id, action, actor_id, by_platform_admin, target_user_id, target_name, details, created_at")
      .eq("shop_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.rpc("admin_shop_members", { p_shop: id }),
  ]);
  for (const r of [shopRes, logRes, membersRes]) if (r.error) throw r.error;
  if (!shopRes.data) notFound();
  const names = new Map(
    (membersRes.data ?? []).map((m) => [m.user_id, m.display_name ?? m.email ?? (m.phone ? `+${m.phone}` : "Unnamed")]),
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/shops/${id}`} className="text-sm text-zinc-500 hover:underline">← {shopRes.data.name}</Link>
        <h1 className="text-2xl font-semibold">Staff activity</h1>
      </div>
      <ActivityList entries={logRes.data ?? []} names={names} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShopStatusButtons, StatusBadge } from "../shared";

export const metadata: Metadata = { title: "Approvals · GemLedger admin" };

export default async function AdminShopsPage() {
  // Non-admins get a 404 rather than learning this page exists.
  if (!(await isPlatformAdmin())) notFound();
  const supabase = await createClient();
  const { data: shops, error } = await supabase
    .from("shops")
    .select("id, name, legal_name, gstin, city, state, phone, status, created_at")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Shop approvals</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Check the GSTIN and phone before approving. Only approved shops can issue passports.
      </p>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {shops.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/admin/shops/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
              <span className="text-sm text-zinc-500">
                {s.city}, {s.state}
                {s.gstin && ` · GSTIN ${s.gstin}`}
                {s.phone && ` · ${s.phone}`}
                {s.legal_name && ` · ${s.legal_name}`}
              </span>
            </div>
            <StatusBadge status={s.status} />
            <ShopStatusButtons shopId={s.id} status={s.status} />
          </li>
        ))}
        {shops.length === 0 && <li className="px-4 py-8 text-center text-zinc-500">No shops yet.</li>}
      </ul>
    </div>
  );
}

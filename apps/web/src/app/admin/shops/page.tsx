import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setShopStatus } from "./actions";

export const metadata: Metadata = { title: "Shops · GemLedger admin" };

const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  suspended: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Shops</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Check the GSTIN and phone before approving. Only approved shops can issue passports.
      </p>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {shops.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-zinc-500">
                {s.city}, {s.state}
                {s.gstin && ` · GSTIN ${s.gstin}`}
                {s.phone && ` · ${s.phone}`}
                {s.legal_name && ` · ${s.legal_name}`}
              </span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{s.status}</span>
            <form action={setShopStatus} className="flex gap-2">
              <input type="hidden" name="shopId" value={s.id} />
              {s.status !== "approved" && (
                <button name="status" value="approved" className="rounded-lg bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800">
                  Approve
                </button>
              )}
              {s.status !== "suspended" && (
                <button name="status" value="suspended" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Suspend
                </button>
              )}
            </form>
          </li>
        ))}
        {shops.length === 0 && <li className="px-4 py-8 text-center text-zinc-500">No shops yet.</li>}
      </ul>
    </main>
  );
}

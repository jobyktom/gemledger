import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatTile, StatusBadge, WeeklyChart, claimRate, dateFmt } from "./shared";

export const metadata: Metadata = { title: "Dashboard · GemLedger admin" };

const SORTS = {
  newest: { label: "Newest shops", key: "created_at" },
  passports: { label: "Most passports", key: "passports_issued" },
  month: { label: "Most this month", key: "issued_this_month" },
  items: { label: "Most items", key: "items" },
  active: { label: "Recently active", key: "last_activity_at" },
} as const;
type SortKey = keyof typeof SORTS;
const STATUSES = ["pending", "approved", "suspended"] as const;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const status = STATUSES.find((s) => s === params.status);
  const sort: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : "newest";

  const supabase = await createClient();
  const [{ data: shops, error }, { data: weeks, error: weeksError }] = await Promise.all([
    supabase.rpc("admin_shop_stats"),
    supabase.rpc("admin_weekly_passports", { p_weeks: 12 }),
  ]);
  if (error) throw error;
  if (weeksError) throw weeksError;

  const sum = (pick: (s: NonNullable<typeof shops>[number]) => number) => shops.reduce((n, s) => n + Number(pick(s)), 0);
  const issued = sum((s) => s.passports_issued);
  const claimed = sum((s) => s.passports_claimed);
  const count = (st: string) => shops.filter((s) => s.status === st).length;
  const activeThisMonth = shops.filter((s) => Number(s.issued_this_month) > 0).length;

  const key = SORTS[sort].key;
  const rows = shops
    .filter((s) => !status || s.status === status)
    .filter((s) => !q || [s.name, s.city, s.state, s.gstin ?? "", s.phone ?? ""].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (key === "created_at" || key === "last_activity_at" ? b[key].localeCompare(a[key]) : Number(b[key]) - Number(a[key])));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {count("pending") > 0 && (
        <Link
          href="/admin/shops"
          className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:underline dark:bg-amber-950 dark:text-amber-200"
        >
          <strong>{count("pending")} shop{count("pending") === 1 ? "" : "s"} waiting for approval.</strong> Review now →
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Shops" value={shops.length} note={`${count("approved")} approved · ${count("pending")} pending · ${count("suspended")} suspended`} />
        <StatTile label="Items registered" value={sum((s) => s.items)} />
        <StatTile label="Passports issued" value={issued} note={`${sum((s) => s.issued_this_month)} this month`} />
        <StatTile label="Passports claimed" value={claimed} note={`Claim rate ${claimRate(claimed, issued)}`} />
      </section>

      <section className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <WeeklyChart weeks={weeks.map((w) => ({ ...w, issued: Number(w.issued), claimed: Number(w.claimed) }))} />
        <StatTile label="Shops active this month" value={activeThisMonth} note="Issued at least one passport since the 1st" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Shops</h2>
        <form className="flex flex-wrap gap-2 text-sm">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search name, city, GSTIN, phone"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="sort" defaultValue={sort} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">Apply</button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Shop</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="px-3 py-2 text-right font-medium">Passports</th>
                <th className="px-3 py-2 text-right font-medium">This month</th>
                <th className="px-3 py-2 text-right font-medium">Claimed</th>
                <th className="px-3 py-2 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((s) => (
                <tr key={s.shop_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-3 py-2">
                    <Link href={`/admin/shops/${s.shop_id}`} className="font-medium hover:underline">{s.name}</Link>
                    <div className="text-xs text-zinc-500">{s.city}, {s.state}</div>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.items}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.passports_issued}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.issued_this_month}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.passports_claimed} <span className="text-xs text-zinc-500">({claimRate(Number(s.passports_claimed), Number(s.passports_issued))})</span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{dateFmt.format(new Date(s.last_activity_at))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No shops match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

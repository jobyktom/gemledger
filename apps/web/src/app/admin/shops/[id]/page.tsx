import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { inviteShopAdmin, setMemberStatus } from "./staff-actions";
import { ActionForm } from "@/app/portal/staff/action-form";
import { ContactFields } from "@/app/portal/staff/forms";
import { Field, Input } from "@/components/ui";
import { ShopStatusButtons, StatTile, StatusBadge, WeeklyChart, claimRate, dateFmt } from "../../shared";

export const metadata: Metadata = { title: "Shop · GemLedger admin" };

const PAGE_SIZE = 50;

export default async function AdminShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();

  const [shopRes, statsRes, membersRes, weeksRes, itemsRes] = await Promise.all([
    supabase.from("shops").select("id, name, legal_name, gstin, city, state, phone, status, created_at").eq("id", id).maybeSingle(),
    supabase.rpc("admin_shop_stats").eq("shop_id", id).maybeSingle(),
    supabase.rpc("admin_shop_members", { p_shop: id }),
    supabase.rpc("admin_weekly_passports", { p_weeks: 12, p_shop: id }),
    supabase
      .from("items")
      .select("id, title, metal, karat, gross_weight_g, created_at, item_huids (huid), documents (storage_path, kind), passports (public_id, status, issued_at, claimed_at)")
      .eq("shop_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE),
  ]);
  for (const r of [shopRes, statsRes, membersRes, weeksRes, itemsRes]) if (r.error) throw r.error;
  const shop = shopRes.data;
  if (!shop) notFound();
  const stats = statsRes.data;
  const members = membersRes.data ?? [];
  const hasNext = (itemsRes.data?.length ?? 0) > PAGE_SIZE;
  const items = (itemsRes.data ?? []).slice(0, PAGE_SIZE);

  const photos = items.map((i) => i.documents.find((d) => d.kind === "photo")?.storage_path).filter((p): p is string => Boolean(p));
  const thumbs = new Map<string, string>();
  if (photos.length) {
    const { data } = await supabase.storage.from("item-files").createSignedUrls(photos, 600);
    for (const s of data ?? []) if (s.path && s.signedUrl) thumbs.set(s.path, s.signedUrl);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← Dashboard</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{shop.name}</h1>
          <StatusBadge status={shop.status} />
          <div className="ml-auto"><ShopStatusButtons shopId={shop.id} status={shop.status} /></div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
        <dt className="text-zinc-500">Location</dt><dd>{shop.city}, {shop.state}</dd>
        <dt className="text-zinc-500">Registered</dt><dd>{dateFmt.format(new Date(shop.created_at))}</dd>
        <dt className="text-zinc-500">Legal name</dt><dd>{shop.legal_name ?? "–"}</dd>
        <dt className="text-zinc-500">GSTIN</dt><dd className="font-mono">{shop.gstin ?? "–"}</dd>
        <dt className="text-zinc-500">Phone</dt><dd>{shop.phone ?? "–"}</dd>
      </dl>

      {stats && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Items" value={stats.items} />
          <StatTile label="Passports issued" value={stats.passports_issued} note={`${stats.issued_this_month} this month`} />
          <StatTile label="Claimed" value={stats.passports_claimed} note={`Claim rate ${claimRate(Number(stats.passports_claimed), Number(stats.passports_issued))}`} />
          <StatTile label="Revoked" value={stats.passports_revoked} />
        </section>
      )}

      <WeeklyChart weeks={(weeksRes.data ?? []).map((w) => ({ ...w, issued: Number(w.issued), claimed: Number(w.claimed) }))} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">People ({members.filter((m) => m.status !== "removed").length})</h2>
          <Link href={`/admin/shops/${shop.id}/staff-activity`} className="text-sm text-zinc-500 hover:underline">Staff activity log</Link>
        </div>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => (
            <li key={m.user_id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 ${m.status === "removed" ? "opacity-60" : ""}`}>
              <span className="flex flex-col">
                <span className="font-medium">{m.display_name ?? m.email ?? (m.phone ? `+${m.phone}` : "No contact")}</span>
                {m.display_name && <span className="text-xs text-zinc-500">{m.email ?? (m.phone ? `+${m.phone}` : "")}</span>}
              </span>
              <span className="text-zinc-500">{m.role === "owner" ? "Shop admin" : m.role === "manager" ? "Manager" : "Staff"}</span>
              {m.status !== "active" && <span className="text-xs capitalize text-red-700 dark:text-red-300">{m.status}</span>}
              <span className="ml-auto text-xs text-zinc-500">
                Last sign-in {m.last_sign_in_at ? dateFmt.format(new Date(m.last_sign_in_at)) : "never"}
              </span>
              {m.status !== "removed" && (
                <ActionForm
                  action={setMemberStatus}
                  submit={m.status === "active" ? "Suspend" : "Reactivate"}
                  variant="secondary"
                  hidden={{ shopId: shop.id, userId: m.user_id, status: m.status === "active" ? "suspended" : "active" }}
                  confirm={m.status === "active" ? "Suspend this person at this shop? Use only in an emergency; it is logged." : undefined}
                />
              )}
            </li>
          ))}
        </ul>
        <details className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <summary className="cursor-pointer font-medium">Recover access: invite a new shop admin</summary>
          <p className="my-3 text-zinc-600 dark:text-zinc-400">
            Only when the shop&apos;s admin has lost access. Check who you&apos;re talking to first, for example by calling the
            shop&apos;s registered number and matching its GSTIN. This is logged in the shop&apos;s activity log.
          </p>
          <ActionForm action={inviteShopAdmin} submit="Invite as shop admin" hidden={{ shopId: shop.id }}>
            <Field label="Name"><Input name="name" maxLength={80} required /></Field>
            <ContactFields />
          </ActionForm>
        </details>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Items and passports</h2>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-500 dark:border-zinc-700">
            {page === 1 ? "This shop has not added any items yet." : "No more items."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((item) => {
              const photo = item.documents.find((d) => d.kind === "photo")?.storage_path;
              const thumb = photo ? thumbs.get(photo) : undefined;
              const passport = item.passports.find((p) => p.status !== "revoked") ?? item.passports[0];
              return (
                <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs
                    <img src={thumb} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="size-12 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/admin/shops/${shop.id}/items/${item.id}`} className="truncate font-medium hover:underline">{item.title}</Link>
                    <span className="text-sm text-zinc-500">
                      <span className="capitalize">{item.metal}</span>
                      {item.karat ? ` ${item.karat}K` : ""} · {Number(item.gross_weight_g).toFixed(3)} g
                      {item.item_huids.length > 0 && ` · HUID ${item.item_huids.map((h) => h.huid).join(", ")}`}
                      {` · added ${dateFmt.format(new Date(item.created_at))}`}
                    </span>
                  </div>
                  <span className="shrink-0 text-right text-xs text-zinc-500">
                    {passport ? (
                      <>
                        Passport {passport.status}
                        <br />
                        {dateFmt.format(new Date(passport.issued_at))}
                      </>
                    ) : (
                      "No passport"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {(page > 1 || hasNext) && (
          <nav className="flex items-center justify-between text-sm" aria-label="Pages">
            {page > 1 ? <Link href={`/admin/shops/${shop.id}?page=${page - 1}`} className="hover:underline">← Newer</Link> : <span />}
            <span className="text-zinc-500">Page {page}</span>
            {hasNext ? <Link href={`/admin/shops/${shop.id}?page=${page + 1}`} className="hover:underline">Older →</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}

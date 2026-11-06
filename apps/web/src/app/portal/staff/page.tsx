import type { Metadata } from "next";
import Link from "next/link";
import { requireMyShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "./action-form";
import { cancelInvite } from "./actions";
import { AddStaffForm } from "./forms";
import { ROLE_LABEL, STATUS_LABEL, formatContact, personName } from "./shared";

export const metadata: Metadata = { title: "Staff · GemLedger" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ removed?: string }> }) {
  const shop = await requireMyShop();
  const isAdmin = shop.role === "owner";
  const showRemoved = isAdmin && (await searchParams).removed === "1";
  const supabase = await createClient();

  const [peopleRes, invitesRes] = await Promise.all([
    supabase.rpc("staff_list", { p_shop: shop.id, p_include_removed: showRemoved }),
    isAdmin
      ? supabase
          .from("shop_invites")
          .select("id, display_name, role, phone, email, for_user_id, replaces_user_id, expires_at")
          .eq("shop_id", shop.id)
          .is("accepted_at", null)
          .is("cancelled_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (peopleRes.error) throw peopleRes.error;
  if (invitesRes.error) throw invitesRes.error;
  const people = peopleRes.data ?? [];
  const invites = invitesRes.data ?? [];
  const admins = people.filter((p) => p.role === "owner" && p.status === "active").length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Staff</h1>
        {isAdmin && (
          <Link href="/portal/staff/activity" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Activity log
          </Link>
        )}
      </div>

      {shop.status === "suspended" && isAdmin && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Your shop is suspended. You can still suspend or remove people, but not add anyone.
        </p>
      )}

      {isAdmin && admins < 2 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Tip:</strong> add a second shop admin (for example a partner), so your shop is never locked out if
          you lose your phone.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {people.map((p) => (
            <li key={p.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                {isAdmin ? (
                  <Link href={`/portal/staff/${p.user_id}`} className="truncate font-medium hover:underline">
                    {personName(p)}
                    {p.is_me && <span className="font-normal text-zinc-500"> (you)</span>}
                  </Link>
                ) : (
                  <span className="truncate font-medium">
                    {p.display_name ?? "Unnamed"}
                    {p.is_me && <span className="font-normal text-zinc-500"> (you)</span>}
                  </span>
                )}
                {isAdmin && p.contact && p.display_name && (
                  <span className="text-sm text-zinc-500">{formatContact(p.contact)}</span>
                )}
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{ROLE_LABEL[p.role]}</span>
              {p.status !== "active" && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
                  {STATUS_LABEL[p.status]}
                </span>
              )}
              {isAdmin && (
                <span className="w-full text-xs text-zinc-500 sm:w-auto">
                  Last sign-in {p.last_sign_in_at ? dateFmt.format(new Date(p.last_sign_in_at)) : "never"}
                </span>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <Link href={showRemoved ? "/portal/staff" : "/portal/staff?removed=1"} className="text-sm text-zinc-500 hover:underline">
            {showRemoved ? "Hide people who have left" : "Show people who have left"}
          </Link>
        )}
      </section>

      {isAdmin && invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Waiting to join</h2>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{i.display_name}</span>
                  <span className="text-zinc-500">
                    {i.for_user_id
                      ? "Offered shop admin, waiting for them to accept"
                      : i.replaces_user_id
                        ? `New sign-in ${formatContact(i.phone ? `+${i.phone}` : i.email)}, waiting for it to be used`
                        : `${ROLE_LABEL[i.role]} · ${formatContact(i.phone ? `+${i.phone}` : i.email)}`}
                    {" · "}expires {dateFmt.format(new Date(i.expires_at))}
                  </span>
                </div>
                <ActionForm action={cancelInvite} submit="Cancel" pendingLabel="Cancelling…" variant="secondary" hidden={{ inviteId: i.id }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && shop.status !== "suspended" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Add someone</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            They join when they sign in to GemLedger with this exact mobile number or email. Nobody else can use the
            invitation, and it expires after 7 days.
          </p>
          <AddStaffForm />
        </section>
      )}
    </div>
  );
}

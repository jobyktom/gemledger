import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Field, Input, Select } from "@/components/ui";
import { requireShopAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "../action-form";
import { changeRole, offerAdmin, renameStaff, setStatus } from "../actions";
import { ActivityList } from "../activity/activity-list";
import { ChangeLoginForm } from "../forms";
import { ROLE_LABEL, STATUS_LABEL, formatContact, personName } from "../shared";

export const metadata: Metadata = { title: "Staff member · GemLedger" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function StaffMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();
  const shop = await requireShopAdmin();
  const supabase = await createClient();
  const since = daysAgo(30);

  const [peopleRes, itemsRes, passportsRes, logRes] = await Promise.all([
    supabase.rpc("staff_list", { p_shop: shop.id, p_include_removed: true }),
    supabase
      .from("items")
      .select("id, title, created_at")
      .eq("shop_id", shop.id)
      .eq("created_by", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("passports")
      .select("public_id, status, issued_at, items (id, title)")
      .eq("shop_id", shop.id)
      .eq("issued_by", userId)
      .gte("issued_at", since)
      .order("issued_at", { ascending: false })
      .limit(50),
    supabase
      .from("staff_activity_log")
      .select("id, action, actor_id, by_platform_admin, target_user_id, target_name, details, created_at")
      .eq("shop_id", shop.id)
      .or(`target_user_id.eq.${userId},actor_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  for (const r of [peopleRes, itemsRes, passportsRes, logRes]) if (r.error) throw r.error;
  const people = peopleRes.data ?? [];
  const person = people.find((p) => p.user_id === userId);
  if (!person) notFound();
  const names = new Map(people.map((p) => [p.user_id, personName(p)]));
  const live = person.status !== "removed";
  const other = !person.is_me;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/portal/staff" className="text-sm text-zinc-500 hover:underline">← Staff</Link>
        <h1 className="text-2xl font-semibold">
          {personName(person)}
          {person.is_me && <span className="font-normal text-zinc-500"> (you)</span>}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {ROLE_LABEL[person.role]} · {STATUS_LABEL[person.status]} · signs in with {formatContact(person.contact) || "unknown"}
          {" · "}joined {dateFmt.format(new Date(person.joined_at))}
        </p>
      </div>

      {person.status === "suspended" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Suspended: they can&apos;t see or change anything in your shop until you reactivate them.
        </p>
      )}
      {person.status === "removed" && (
        <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          This person has left your shop. To bring them back, invite them again from the Staff page.
        </p>
      )}

      {live && (
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Name</h2>
            <ActionForm action={renameStaff} submit="Save name" hidden={{ userId }} variant="secondary">
              <Input name="name" defaultValue={person.display_name ?? ""} maxLength={80} aria-label="Name" required />
            </ActionForm>
          </div>

          {other && (
            <div className="flex flex-col gap-2">
              <h2 className="font-medium">Role</h2>
              {person.role === "owner" ? (
                <ActionForm
                  action={changeRole}
                  submit="Step down to manager"
                  variant="secondary"
                  hidden={{ userId, role: "manager" }}
                  confirm="Remove shop admin rights from this person? They stay on as a manager."
                />
              ) : (
                <>
                  <ActionForm action={changeRole} submit="Change role" variant="secondary" hidden={{ userId }}>
                    <Field label="Role">
                      <Select name="role" defaultValue={person.role}>
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                      </Select>
                    </Field>
                  </ActionForm>
                  {person.status === "active" && (
                    <ActionForm
                      action={offerAdmin}
                      submit="Make shop admin"
                      variant="secondary"
                      hidden={{ userId }}
                      confirm="Offer shop admin rights? They will be able to add and remove anyone, including you."
                    />
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Sign-in phone or email</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Use this when they change number or lose their phone. If the phone was lost or stolen, suspend them first.
            </p>
            <ChangeLoginForm userId={userId} />
          </div>

          {other && (
            <div className="flex flex-col gap-2">
              <h2 className="font-medium">Access</h2>
              {person.status === "active" ? (
                <ActionForm
                  action={setStatus}
                  submit="Suspend"
                  variant="secondary"
                  hidden={{ userId, status: "suspended" }}
                  confirm="Suspend this person? They lose access straight away. You can reactivate them later."
                />
              ) : (
                <ActionForm action={setStatus} submit="Reactivate" variant="secondary" hidden={{ userId, status: "active" }} />
              )}
              <ActionForm
                action={setStatus}
                submit="Remove from shop"
                variant="secondary"
                hidden={{ userId, status: "removed" }}
                confirm="Remove this person from your shop? They lose access straight away. Their past work stays on record."
              />
            </div>
          )}
          {person.is_me && (
            <p className="text-sm text-zinc-500 sm:col-span-2">
              To change your own role or leave the shop, ask another shop admin.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Their work in the last 30 days</h2>
        {!itemsRes.data?.length && !passportsRes.data?.length ? (
          <p className="text-sm text-zinc-500">No items added or passports issued.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {(itemsRes.data ?? []).map((i) => (
              <li key={i.id} className="flex gap-4 px-4 py-2">
                <span className="text-zinc-500">{dateFmt.format(new Date(i.created_at))}</span>
                <span>Added <Link href={`/portal/items/${i.id}`} className="hover:underline">{i.title}</Link></span>
              </li>
            ))}
            {(passportsRes.data ?? []).map((p) => (
              <li key={p.public_id} className="flex gap-4 px-4 py-2">
                <span className="text-zinc-500">{dateFmt.format(new Date(p.issued_at))}</span>
                <span>
                  Issued passport for{" "}
                  {p.items ? <Link href={`/portal/items/${p.items.id}`} className="hover:underline">{p.items.title}</Link> : "an item"}
                  {p.status === "revoked" && " (revoked)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">History</h2>
        <ActivityList entries={logRes.data ?? []} names={names} />
      </section>
    </div>
  );
}

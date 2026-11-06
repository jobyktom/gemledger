import { verificationLabels } from "@gemledger/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dateFmt, rupees } from "../../../../shared";

export const metadata: Metadata = { title: "Item · GemLedger admin" };

const KIND_LABEL: Record<string, string> = {
  photo: "Photo",
  invoice: "Invoice",
  warranty: "Warranty",
  lab_report: "Lab report",
  hallmark: "Hallmark",
  other: "Other",
};

export default async function AdminItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(itemId).success) notFound();
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("items")
    .select(
      "id, title, description, metal, karat, gross_weight_g, net_weight_g, price_paise, created_at, shops (name), item_huids (huid), grading_reports (lab, report_number, status, checked_at), documents (storage_path, kind, created_at), passports (public_id, status, issued_at, claimed_at, revoked_at)",
    )
    .eq("id", itemId)
    .eq("shop_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!item) notFound();

  const paths = item.documents.map((d) => d.storage_path);
  const { data: signed } = paths.length ? await supabase.storage.from("item-files").createSignedUrls(paths, 600) : { data: [] };
  const urlFor = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  const photos = item.documents.filter((d) => d.kind === "photo");
  const otherDocs = item.documents.filter((d) => d.kind !== "photo");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/shops/${id}`} className="text-sm text-zinc-500 hover:underline">← {item.shops?.name ?? "Shop"}</Link>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="text-sm text-zinc-500">Read-only view. Only the shop can change this item.</p>
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p) => {
            const url = urlFor.get(p.storage_path);
            return url ? (
              <a key={p.storage_path} href={url} target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
                <img src={url} alt="" className="size-32 shrink-0 rounded-lg object-cover" />
              </a>
            ) : null;
          })}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Metal</dt>
        <dd className="capitalize">{item.metal}{item.karat ? `, ${item.karat}K` : ""}</dd>
        <dt className="text-zinc-500">Gross weight</dt>
        <dd>{Number(item.gross_weight_g).toFixed(3)} g</dd>
        {item.net_weight_g && (<><dt className="text-zinc-500">Net weight</dt><dd>{Number(item.net_weight_g).toFixed(3)} g</dd></>)}
        {item.item_huids.length > 0 && (<><dt className="text-zinc-500">HUID</dt><dd className="font-mono">{item.item_huids.map((h) => h.huid).join(", ")}</dd></>)}
        {item.grading_reports.map((r) => (
          <Fragment key={`${r.lab}-${r.report_number}`}>
            <dt className="text-zinc-500">{r.lab} report</dt>
            <dd>{r.report_number} · {verificationLabels[r.status]}</dd>
          </Fragment>
        ))}
        {item.price_paise !== null && (<><dt className="text-zinc-500">Price (shop private)</dt><dd>{rupees.format(item.price_paise / 100)}</dd></>)}
        {item.description && (<><dt className="text-zinc-500">Notes</dt><dd className="whitespace-pre-line">{item.description}</dd></>)}
        <dt className="text-zinc-500">Added</dt>
        <dd>{dateFmt.format(new Date(item.created_at))}</dd>
      </dl>

      {otherDocs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Documents</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {otherDocs.map((d) => {
              const url = urlFor.get(d.storage_path);
              return (
                <li key={d.storage_path}>
                  {url ? <a href={url} target="_blank" className="text-amber-700 hover:underline">{KIND_LABEL[d.kind] ?? d.kind}</a> : KIND_LABEL[d.kind] ?? d.kind}
                  <span className="text-zinc-500"> · {dateFmt.format(new Date(d.created_at))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Passport</h2>
        {item.passports.length === 0 ? (
          <p className="text-sm text-zinc-500">No passport issued yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {item.passports.map((p) => (
              <li key={p.public_id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="font-medium capitalize">{p.status}</p>
                <p className="text-zinc-500">
                  Issued {dateFmt.format(new Date(p.issued_at))}
                  {p.claimed_at && ` · claimed ${dateFmt.format(new Date(p.claimed_at))}`}
                  {p.revoked_at && ` · revoked ${dateFmt.format(new Date(p.revoked_at))}`}
                </p>
                <Link href={`/p/${p.public_id}`} target="_blank" className="text-amber-700 hover:underline">Open public passport page</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { verificationLabels } from "@gemledger/shared";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { requireMyShop } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { IssueButton } from "./issue-button";
import { PrintButton } from "./print-button";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const shop = await requireMyShop();
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("items")
    .select(
      "id, title, description, metal, karat, gross_weight_g, net_weight_g, price_paise, created_at, item_huids (huid), grading_reports (lab, report_number, status), documents (storage_path, kind), passports (public_id, status, issued_at)",
    )
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (error) throw error;
  if (!item) notFound();

  const photoPaths = item.documents.filter((d) => d.kind === "photo").map((d) => d.storage_path);
  const { data: signed } = photoPaths.length
    ? await supabase.storage.from("item-files").createSignedUrls(photoPaths, 600)
    : { data: [] };

  const passport = item.passports.find((p) => p.status !== "revoked");
  const passportUrl = passport ? `${await siteOrigin()}/p/${passport.public_id}` : undefined;
  const qrSvg = passportUrl
    ? await QRCode.toString(passportUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 print:hidden">
        <Link href="/portal" className="text-sm text-zinc-500 hover:underline">← All items</Link>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
      </div>

      {(signed ?? []).length > 0 && (
        <div className="flex gap-2 overflow-x-auto print:hidden">
          {(signed ?? []).map((s) =>
            s.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs
              <img key={s.path} src={s.signedUrl} alt="" className="size-32 shrink-0 rounded-lg object-cover" />
            ) : null,
          )}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm print:hidden">
        <dt className="text-zinc-500">Metal</dt>
        <dd className="capitalize">{item.metal}{item.karat ? `, ${item.karat}K` : ""}</dd>
        <dt className="text-zinc-500">Gross weight</dt>
        <dd>{Number(item.gross_weight_g).toFixed(3)} g</dd>
        {item.net_weight_g && (<><dt className="text-zinc-500">Net weight</dt><dd>{Number(item.net_weight_g).toFixed(3)} g</dd></>)}
        {item.item_huids.length > 0 && (<><dt className="text-zinc-500">HUID</dt><dd className="font-mono">{item.item_huids.map((h) => h.huid).join(", ")}</dd></>)}
        {item.grading_reports.map((r) => (
          <Fragment key={`${r.lab}-${r.report_number}`}><dt className="text-zinc-500">{r.lab} report</dt><dd>{r.report_number} · {verificationLabels[r.status]}</dd></Fragment>
        ))}
        {item.price_paise !== null && (<><dt className="text-zinc-500">Price (private)</dt><dd>{rupees.format(item.price_paise / 100)}</dd></>)}
        {item.description && (<><dt className="text-zinc-500">Notes</dt><dd className="whitespace-pre-line">{item.description}</dd></>)}
      </dl>

      <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 print:border-0 print:p-0">
        <h2 className="text-lg font-medium print:hidden">Digital passport</h2>
        {passport && qrSvg && passportUrl ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* Printable card: QR, shop and item name only; no price or owner. */}
            <div className="flex w-56 flex-col items-center gap-2 rounded-lg border border-zinc-300 bg-white p-4 text-center text-black">
              <div className="w-44" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <span className="text-sm font-semibold">{shop.name}</span>
              <span className="text-xs">{item.title}</span>
              <span className="text-[10px] text-zinc-600">Scan to view your GemLedger passport</span>
            </div>
            <div className="flex flex-col gap-2 text-sm print:hidden">
              <p>Issued {new Date(passport.issued_at).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {passport.status}</p>
              <a href={passportUrl} target="_blank" className="break-all link-gold">{passportUrl}</a>
              <PrintButton />
            </div>
          </div>
        ) : (
          <IssueButton
            itemId={item.id}
            disabledReason={shop.status !== "approved" ? "Available once your shop is approved." : undefined}
          />
        )}
      </section>
    </div>
  );
}

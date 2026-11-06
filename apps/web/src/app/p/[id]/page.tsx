import { verificationLabels } from "@gemledger/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicPassport as loadPassport } from "@/lib/passport";
import { dateFmt, metalLabel } from "@/lib/passport-text";
import { walletAvailability } from "@/lib/wallet/config";
import { WalletButtons } from "./wallet-buttons";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const passport = await loadPassport((await params).id);
  return {
    title: passport ? `${passport.item_title} · GemLedger passport` : "Passport not found · GemLedger",
    robots: { index: false, follow: false },
  };
}

export default async function PublicPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const passport = await loadPassport((await params).id);
  if (!passport) notFound();
  const revoked = passport.status === "revoked";
  const wallet = walletAvailability();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">GemLedger digital passport</p>
        <h1 className="text-2xl font-semibold">{passport.item_title}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Issued by {passport.shop_name}, {passport.shop_city} on {dateFmt.format(new Date(passport.issued_at))}
        </p>
      </header>

      {revoked && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          This passport has been revoked by the jeweller and is no longer valid.
        </p>
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        <dt className="text-zinc-500">Metal</dt>
        <dd>
          {metalLabel[passport.metal] ?? passport.metal}
          {passport.karat ? ` · ${passport.karat}K` : ""}
        </dd>
        <dt className="text-zinc-500">Gross weight</dt>
        <dd>{Number(passport.gross_weight_g).toFixed(3)} g</dd>
        {passport.huids.length > 0 && (
          <>
            <dt className="text-zinc-500">BIS HUID</dt>
            <dd className="font-mono">{passport.huids.join(", ")}</dd>
          </>
        )}
      </dl>

      {passport.reports.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Grading reports</h2>
          <ul className="flex flex-col gap-2">
            {passport.reports.map((r) => (
              <li key={`${r.lab}-${r.report_number}`} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="font-medium">
                  {r.lab} · <span className="font-mono">{r.report_number}</span>
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{verificationLabels[r.status]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!revoked && <WalletButtons publicId={passport.public_id} {...wallet} />}

      <p className="text-sm text-zinc-500">
        HUID numbers can be checked independently in the BIS CARE app. GemLedger shows what the jeweller recorded and
        marks a grading report as lab matched only after checking it with the lab.
      </p>
    </main>
  );
}

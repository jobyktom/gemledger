import { PublicPassportId, VerificationStatus, verificationLabels } from "@gemledger/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Report = z.object({
  lab: z.string(),
  report_number: z.string(),
  status: VerificationStatus,
  checked_at: z.string().nullable(),
});

// Only what get_public_passport exposes: never price, owner or documents.
const loadPassport = cache(async (id: string) => {
  if (!PublicPassportId.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_passport", { p_public_id: id });
  if (error) throw new Error("Could not load passport");
  const row = data?.[0];
  if (!row) return null;
  return { ...row, reports: z.array(Report).catch([]).parse(row.reports) };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const passport = await loadPassport((await params).id);
  return {
    title: passport ? `${passport.item_title} · GemLedger passport` : "Passport not found · GemLedger",
    robots: { index: false, follow: false },
  };
}

const metalLabel: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum", other: "Other" };
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function PublicPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const passport = await loadPassport((await params).id);
  if (!passport) notFound();
  const revoked = passport.status === "revoked";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-zinc-500">GemLedger digital passport</p>
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

      <p className="text-sm text-zinc-500">
        HUID numbers can be checked independently in the BIS CARE app. GemLedger shows what the jeweller recorded and
        marks a grading report as lab matched only after checking it with the lab.
      </p>
    </main>
  );
}

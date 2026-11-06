import "server-only";
import { PublicPassportId, VerificationStatus } from "@gemledger/shared";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Report = z.object({
  lab: z.string(),
  report_number: z.string(),
  status: VerificationStatus,
  checked_at: z.string().nullable(),
});

/**
 * Only what get_public_passport exposes: never price, owner or documents.
 * Shared by the passport page and the wallet passes, so both always show
 * exactly the same details.
 */
export const loadPublicPassport = cache(async (id: string) => {
  if (!PublicPassportId.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_passport", { p_public_id: id });
  if (error) throw new Error("Could not load passport");
  const row = data?.[0];
  if (!row) return null;
  return { ...row, reports: z.array(Report).catch([]).parse(row.reports) };
});

export type PublicPassport = NonNullable<Awaited<ReturnType<typeof loadPublicPassport>>>;

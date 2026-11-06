import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublicPassport } from "@/lib/passport";
import { siteOrigin } from "@/lib/site";
import { applePassJson, buildPkpass, type AppleCredentials } from "./apple-pass";

/** The pass's Apple authentication token and when its contents last changed. */
export async function applePassMeta(publicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wallet_pass_meta", { p_public_id: publicId });
  if (error) throw new Error("Could not load wallet pass details");
  const row = data?.[0];
  return row ? { token: row.token, updatedAt: new Date(row.updated_at) } : null;
}

/** A signed .pkpass for a passport, ready to send to an iPhone. */
export async function applePassFor(passport: PublicPassport, creds: AppleCredentials) {
  const meta = await applePassMeta(passport.public_id);
  if (!meta) return null;
  const origin = await siteOrigin();
  const pass = applePassJson(passport, {
    passportUrl: `${origin}/p/${passport.public_id}`,
    webServiceUrl: `${origin}/api/wallet/apple`,
    authToken: meta.token,
    passTypeId: creds.passTypeId,
    teamId: creds.teamId,
  });
  return { body: buildPkpass(pass, creds), updatedAt: meta.updatedAt };
}

export function pkpassResponse(pass: { body: Uint8Array; updatedAt: Date }, filename?: string) {
  return new Response(Buffer.from(pass.body), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": pass.updatedAt.toUTCString(),
      "Cache-Control": "no-store",
      ...(filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    },
  });
}

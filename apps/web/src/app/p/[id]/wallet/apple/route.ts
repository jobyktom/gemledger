import { loadPublicPassport } from "@/lib/passport";
import { applePassFor, pkpassResponse } from "@/lib/wallet/apple";
import { appleWallet } from "@/lib/wallet/config";

/** "Add to Apple Wallet": downloads the passport as a .pkpass file. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[id]/wallet/apple">) {
  const creds = appleWallet();
  if (!creds) return new Response("Apple Wallet is not available yet.", { status: 404 });
  const passport = await loadPublicPassport((await ctx.params).id);
  if (!passport) return new Response("Passport not found.", { status: 404 });
  if (passport.status === "revoked") return new Response("This passport has been revoked.", { status: 410 });
  const pass = await applePassFor(passport, creds);
  if (!pass) return new Response("Passport not found.", { status: 404 });
  return pkpassResponse(pass, "GemLedger-passport.pkpass");
}

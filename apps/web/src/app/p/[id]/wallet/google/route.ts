import { loadPublicPassport } from "@/lib/passport";
import { siteOrigin } from "@/lib/site";
import { googleWallet } from "@/lib/wallet/config";
import { googleSaveUrl } from "@/lib/wallet/google-pass";

/** "Add to Google Wallet": sends the customer to Google's save page for this passport. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[id]/wallet/google">) {
  const creds = googleWallet();
  if (!creds) return new Response("Google Wallet is not available yet.", { status: 404 });
  const passport = await loadPublicPassport((await ctx.params).id);
  if (!passport) return new Response("Passport not found.", { status: 404 });
  if (passport.status === "revoked") return new Response("This passport has been revoked.", { status: 410 });
  const origin = await siteOrigin();
  const url = googleSaveUrl(passport, creds, {
    origin,
    passportUrl: `${origin}/p/${passport.public_id}`,
    logoUrl: `${origin}/api/wallet/logo`,
  });
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
}

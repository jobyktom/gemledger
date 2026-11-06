import "server-only";
import { connect } from "node:http2";
import { loadPublicPassport } from "@/lib/passport";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { appleWallet, googleWallet } from "./config";
import { googleObject, googleObjectId, signJwt, type GoogleCredentials } from "./google-pass";

/**
 * Tells phones holding a passport's wallet pass that it changed, so a revoked
 * or transferred passport updates in Apple Wallet and Google Wallet. Call it
 * after changing a passport (from a signed-in shop or admin request).
 * Best effort: failures are logged, never thrown.
 */
export async function notifyWalletPassChanged(publicId: string): Promise<void> {
  await Promise.all([notifyApple(publicId), updateGoogle(publicId)]).catch((e) =>
    console.error("Wallet update failed", e instanceof Error ? e.message : e),
  );
}

async function notifyApple(publicId: string) {
  const creds = appleWallet();
  if (!creds) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wallet_apple_push_tokens", { p_public_id: publicId });
  if (error) throw new Error(`Could not read Apple push tokens: ${error.message}`);
  const tokens = (data ?? []).map((r) => r.push_token);
  if (!tokens.length) return;

  // Wallet pushes carry an empty payload; the phone then asks our web service for the new pass.
  const session = connect("https://api.push.apple.com", { cert: creds.certificatePem, key: creds.privateKeyPem });
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = session.request({ ":method": "POST", ":path": `/3/device/${token}`, "apns-topic": creds.passTypeId });
            req.on("response", (headers) => {
              if (headers[":status"] !== 200) console.warn(`Apple push for ${publicId} returned ${headers[":status"]}`);
            });
            req.on("error", (e) => console.warn("Apple push failed", e.message));
            req.on("close", resolve);
            req.end("{}");
          }),
      ),
    );
  } finally {
    session.close();
  }
}

async function googleAccessToken(creds: GoogleCredentials) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: creds.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    creds.serviceAccount,
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function updateGoogle(publicId: string) {
  const creds = googleWallet();
  if (!creds) return;
  const passport = await loadPublicPassport(publicId);
  if (!passport) return;
  const origin = await siteOrigin();
  const object = googleObject(passport, {
    issuerId: creds.issuerId,
    passportUrl: `${origin}/p/${publicId}`,
    logoUrl: `${origin}/api/wallet/logo`,
  });
  const res = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(googleObjectId(creds.issuerId, publicId))}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${await googleAccessToken(creds)}`, "Content-Type": "application/json" },
      body: JSON.stringify(object),
    },
  );
  // 404: no customer has saved this passport to Google Wallet yet.
  if (!res.ok && res.status !== 404) throw new Error(`Google Wallet update failed (${res.status})`);
}

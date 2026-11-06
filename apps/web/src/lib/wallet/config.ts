import "server-only";
import { parseAppleCredentials, type AppleCredentials } from "./apple-pass";
import { parseGoogleServiceAccount, type GoogleCredentials } from "./google-pass";

/*
 * Wallet passes switch on by themselves once their settings are added on the
 * server (see docs/LAUNCH_CHECKLIST.md). Until then the buttons stay hidden
 * and the wallet routes answer 404.
 *
 * Apple Wallet:  APPLE_WALLET_CERT_P12, APPLE_WALLET_CERT_PASSWORD, APPLE_WALLET_WWDR_CERT
 * Google Wallet: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT
 */

let apple: { creds: AppleCredentials | null } | undefined;
let google: { creds: GoogleCredentials | null } | undefined;

export function appleWallet(): AppleCredentials | null {
  if (!apple) {
    const { APPLE_WALLET_CERT_P12: p12, APPLE_WALLET_CERT_PASSWORD: password = "", APPLE_WALLET_WWDR_CERT: wwdr } = process.env;
    apple = { creds: null };
    if (p12 && wwdr) {
      try {
        apple.creds = parseAppleCredentials(p12, password, wwdr);
        const expires = apple.creds.certificate.validity.notAfter;
        if (expires < new Date()) {
          console.error(`Apple Wallet is off: the Pass Type ID certificate expired on ${expires.toISOString()}`);
          apple.creds = null;
        }
      } catch (e) {
        console.error("Apple Wallet is off: its settings could not be read.", e instanceof Error ? e.message : e);
      }
    }
  }
  return apple.creds;
}

export function googleWallet(): GoogleCredentials | null {
  if (!google) {
    const { GOOGLE_WALLET_ISSUER_ID: issuerId, GOOGLE_WALLET_SERVICE_ACCOUNT: account } = process.env;
    google = { creds: null };
    if (issuerId && account) {
      try {
        if (!/^\d+$/.test(issuerId.trim())) throw new Error("GOOGLE_WALLET_ISSUER_ID should be a number");
        google.creds = { issuerId: issuerId.trim(), serviceAccount: parseGoogleServiceAccount(account) };
      } catch (e) {
        console.error("Google Wallet is off: its settings could not be read.", e instanceof Error ? e.message : e);
      }
    }
  }
  return google.creds;
}

export function walletAvailability() {
  return { apple: appleWallet() !== null, google: googleWallet() !== null };
}

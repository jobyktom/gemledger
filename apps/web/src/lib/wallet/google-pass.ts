import { createSign } from "node:crypto";
import { z } from "zod";
import { passportText, type PassportFacts } from "../passport-text";

/** The fields we use from a Google Cloud service account key file. */
export const GoogleServiceAccount = z.object({
  client_email: z.string().email(),
  private_key: z.string().includes("PRIVATE KEY"),
});
export type GoogleServiceAccount = z.infer<typeof GoogleServiceAccount>;

export type GoogleCredentials = { issuerId: string; serviceAccount: GoogleServiceAccount };

/** Accepts the key file as JSON text or as base64 of it. */
export function parseGoogleServiceAccount(input: string): GoogleServiceAccount {
  const text = input.trim();
  const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
  return GoogleServiceAccount.parse(JSON.parse(json));
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** An RS256 JSON Web Token signed with the service account's key. */
export function signJwt(claims: object, serviceAccount: GoogleServiceAccount): string {
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${b64url(signature)}`;
}

/** One class holds the layout shared by every GemLedger passport. */
export const googleClassId = (issuerId: string) => `${issuerId}.gemledger_passport`;
export const googleObjectId = (issuerId: string, publicId: string) => `${issuerId}.${publicId}`;

const field = (id: string) => ({ fields: [{ fieldPath: `object.textModulesData['${id}']` }] });

export function googleClass(issuerId: string) {
  return {
    id: googleClassId(issuerId),
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          { twoItems: { startItem: { firstValue: field("metal") }, endItem: { firstValue: field("weight") } } },
          { twoItems: { startItem: { firstValue: field("huid") }, endItem: { firstValue: field("issued") } } },
        ],
      },
    },
  };
}

const text = (value: string) => ({ defaultValue: { language: "en-IN", value } });

/** The Google Wallet card for a passport: the same public details as the passport page. */
export function googleObject(passport: PassportFacts, opts: { issuerId: string; passportUrl: string; logoUrl: string }) {
  const t = passportText(passport);
  return {
    id: googleObjectId(opts.issuerId, passport.public_id),
    classId: googleClassId(opts.issuerId),
    state: t.revoked ? "INACTIVE" : "ACTIVE",
    cardTitle: text("GemLedger passport"),
    header: text(t.title),
    subheader: text(`Issued by ${t.shop}`),
    // Emerald, matching the website.
    hexBackgroundColor: "#0b2a1f",
    logo: { sourceUri: { uri: opts.logoUrl }, contentDescription: text("GemLedger") },
    barcode: { type: "QR_CODE", value: opts.passportUrl, alternateText: "Scan to verify" },
    textModulesData: [
      { id: "status", header: "Status", body: t.status },
      { id: "metal", header: "Metal", body: t.metal },
      { id: "weight", header: "Gross weight", body: t.weight },
      { id: "huid", header: "BIS HUID", body: t.huid ?? "None recorded" },
      { id: "issued", header: "Issued", body: t.issued },
      ...(t.reports.length ? [{ id: "reports", header: "Grading reports", body: t.reports.join("\n") }] : []),
      { id: "notice", header: "About this passport", body: t.notice },
    ],
    linksModuleData: { uris: [{ id: "live", uri: opts.passportUrl, description: "View the live passport" }] },
  };
}

/** A "Save to Google Wallet" link that creates the card on the customer's phone. */
export function googleSaveUrl(
  passport: PassportFacts,
  creds: GoogleCredentials,
  opts: { origin: string; passportUrl: string; logoUrl: string },
): string {
  const jwt = signJwt(
    {
      iss: creds.serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [opts.origin],
      payload: {
        genericClasses: [googleClass(creds.issuerId)],
        genericObjects: [googleObject(passport, { issuerId: creds.issuerId, ...opts })],
      },
    },
    creds.serviceAccount,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

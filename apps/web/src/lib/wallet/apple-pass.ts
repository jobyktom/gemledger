import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import forge from "node-forge";
import { passportText, type PassportFacts } from "../passport-text";
import { applePassImages } from "./images";

/** Everything needed to sign Apple Wallet passes, parsed from the Pass Type ID certificate. */
export type AppleCredentials = {
  passTypeId: string;
  teamId: string;
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  wwdr: forge.pki.Certificate;
  /** PEM copies, for the push connection to Apple. */
  certificatePem: string;
  privateKeyPem: string;
};

function readCertificate(input: string): forge.pki.Certificate {
  const text = input.trim();
  if (text.startsWith("-----BEGIN")) return forge.pki.certificateFromPem(text);
  // Base64 of the .cer file (DER), as downloaded from Apple.
  return forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.decode64(text.replace(/\s+/g, ""))));
}

/**
 * Reads the .p12 exported for the Pass Type ID certificate (base64) and
 * Apple's WWDR intermediate certificate. The pass type ID and team ID are
 * taken from the certificate itself, so they can never disagree with it.
 */
export function parseAppleCredentials(p12Base64: string, password: string, wwdrCert: string): AppleCredentials {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(p12Base64.replace(/\s+/g, ""))), password);
  const certificate = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;
  const keyBag =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  const privateKey = keyBag?.key;
  if (!certificate || !privateKey) throw new Error("The Apple Wallet .p12 must contain the certificate and its private key");

  const passTypeId = certificate.subject.getField({ type: "0.9.2342.19200300.100.1.1" })?.value as string | undefined;
  const teamId = certificate.subject.getField("OU")?.value as string | undefined;
  if (!passTypeId?.startsWith("pass.") || !teamId) throw new Error("This is not an Apple Pass Type ID certificate");

  return {
    passTypeId,
    teamId,
    certificate,
    privateKey,
    wwdr: readCertificate(wwdrCert),
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(privateKey as forge.pki.rsa.PrivateKey),
  };
}

// Emerald and champagne gold, matching the website.
const colours = {
  backgroundColor: "rgb(11, 42, 31)",
  foregroundColor: "rgb(241, 237, 227)",
  labelColor: "rgb(214, 181, 113)",
};

/** pass.json for a passport: the same public details as the passport page. */
export function applePassJson(
  passport: PassportFacts,
  opts: { passportUrl: string; webServiceUrl: string; authToken: string; passTypeId: string; teamId: string },
) {
  const t = passportText(passport);
  return {
    formatVersion: 1,
    passTypeIdentifier: opts.passTypeId,
    teamIdentifier: opts.teamId,
    serialNumber: passport.public_id,
    organizationName: "GemLedger",
    description: `GemLedger passport: ${t.title}`,
    logoText: "GemLedger",
    ...colours,
    webServiceURL: opts.webServiceUrl,
    authenticationToken: opts.authToken,
    voided: t.revoked,
    barcodes: [
      { format: "PKBarcodeFormatQR", message: opts.passportUrl, messageEncoding: "iso-8859-1", altText: "Scan to verify" },
    ],
    generic: {
      headerFields: [{ key: "status", label: "STATUS", value: t.status, changeMessage: "Passport status: %@" }],
      primaryFields: [{ key: "item", label: "JEWELLERY", value: t.title }],
      secondaryFields: [
        { key: "metal", label: "METAL", value: t.metal },
        { key: "weight", label: "GROSS WEIGHT", value: t.weight, textAlignment: "PKTextAlignmentRight" },
      ],
      auxiliaryFields: [
        ...(t.huid ? [{ key: "huid", label: "BIS HUID", value: t.huid }] : []),
        { key: "issued", label: "ISSUED", value: t.issued, textAlignment: "PKTextAlignmentRight" },
      ],
      backFields: [
        { key: "shop", label: "Issued by", value: t.shop },
        ...(t.reports.length ? [{ key: "reports", label: "Grading reports", value: t.reports.join("\n") }] : []),
        {
          key: "live",
          label: "Live passport",
          value: opts.passportUrl,
          attributedValue: `<a href="${opts.passportUrl}">View the live passport</a>`,
        },
        { key: "notice", label: "About this passport", value: t.notice },
      ],
    },
  };
}

const sha1 = (data: Uint8Array) => createHash("sha1").update(data).digest("hex");

/** Detached PKCS#7 signature of manifest.json, as Apple Wallet requires. */
function sign(manifest: Uint8Array, creds: AppleCredentials): Uint8Array {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(Buffer.from(manifest).toString("binary"));
  p7.addCertificate(creds.wwdr);
  p7.addCertificate(creds.certificate);
  p7.addSigner({
    key: creds.privateKey as forge.pki.rsa.PrivateKey,
    certificate: creds.certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // forge fills in the time when the value is left out.
      { type: forge.pki.oids.signingTime } as { type: string; value: string },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/** A signed .pkpass file (a zip of pass.json, images, manifest and signature). */
export function buildPkpass(passJson: object, creds: AppleCredentials): Uint8Array {
  const files: Record<string, Uint8Array> = { "pass.json": new TextEncoder().encode(JSON.stringify(passJson)) };
  for (const [name, b64] of Object.entries(applePassImages)) files[name] = Buffer.from(b64, "base64");
  const manifest = new TextEncoder().encode(
    JSON.stringify(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, sha1(data)]))),
  );
  return zipSync({ ...files, "manifest.json": manifest, signature: sign(manifest, creds) }, { level: 6 });
}

import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import type { PassportFacts } from "../passport-text";
import { applePassJson, buildPkpass, parseAppleCredentials } from "./apple-pass";
import { googleObject, googleSaveUrl, parseGoogleServiceAccount } from "./google-pass";

const passport: PassportFacts = {
  public_id: "AbCdEfGhIjKlMnOpQrStUv",
  status: "issued",
  issued_at: "2026-11-06T09:00:00Z",
  shop_name: "Asha Jewellers",
  shop_city: "Kochi",
  item_title: "Temple necklace",
  metal: "gold",
  karat: 22,
  gross_weight_g: 32.5,
  huids: ["AB12CD"],
  reports: [{ lab: "IGI", report_number: "LG123", status: "uploaded" }],
};

// A stand-in for Apple's WWDR intermediate and a Pass Type ID certificate it issued.
function testCertificates() {
  const caKeys = forge.pki.rsa.generateKeyPair(1024);
  const ca = forge.pki.createCertificate();
  ca.publicKey = caKeys.publicKey;
  ca.serialNumber = "01";
  ca.validity.notBefore = new Date(Date.now() - 86400000);
  ca.validity.notAfter = new Date(Date.now() + 86400000);
  ca.setSubject([{ name: "commonName", value: "Test WWDR" }]);
  ca.setIssuer(ca.subject.attributes);
  ca.setExtensions([{ name: "basicConstraints", cA: true }]);
  ca.sign(caKeys.privateKey, forge.md.sha256.create());

  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "02";
  cert.validity.notBefore = ca.validity.notBefore;
  cert.validity.notAfter = ca.validity.notAfter;
  cert.setSubject([
    { type: "0.9.2342.19200300.100.1.1", value: "pass.com.example.test" },
    { name: "commonName", value: "Pass Type ID: pass.com.example.test" },
    { shortName: "OU", value: "TEAM123456" },
  ]);
  cert.setIssuer(ca.subject.attributes);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());

  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "secret", { algorithm: "3des" });
  return {
    p12Base64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()),
    wwdrPem: forge.pki.certificateToPem(ca),
  };
}

describe("Apple Wallet pass", () => {
  const { p12Base64, wwdrPem } = testCertificates();
  const creds = parseAppleCredentials(p12Base64, "secret", wwdrPem);
  const opts = {
    passportUrl: "https://gemledger.example/p/AbCdEfGhIjKlMnOpQrStUv",
    webServiceUrl: "https://gemledger.example/api/wallet/apple",
    authToken: "0123456789abcdef0123",
    passTypeId: creds.passTypeId,
    teamId: creds.teamId,
  };

  it("reads the pass type and team from the certificate", () => {
    expect(creds.passTypeId).toBe("pass.com.example.test");
    expect(creds.teamId).toBe("TEAM123456");
  });

  it("shows the public details and never the price or owner", () => {
    const pass = applePassJson(passport, opts);
    expect(pass.serialNumber).toBe(passport.public_id);
    expect(pass.voided).toBe(false);
    expect(pass.barcodes[0].message).toBe(opts.passportUrl);
    const text = JSON.stringify(pass);
    expect(text).toContain("Temple necklace");
    expect(text).toContain("Gold · 22K");
    expect(text).toContain("32.500 g");
    expect(text).toContain("AB12CD");
    expect(text).toContain("IGI LG123: Uploaded");
    expect(text).not.toMatch(/price|owner|claimed_by/i);
  });

  it("voids a revoked passport", () => {
    const pass = applePassJson({ ...passport, status: "revoked" }, opts);
    expect(pass.voided).toBe(true);
    expect(pass.generic.headerFields[0].value).toBe("Revoked");
  });

  it("builds a .pkpass whose manifest and signature check out", () => {
    const files = unzipSync(buildPkpass(applePassJson(passport, opts), creds));
    expect(Object.keys(files).sort()).toEqual(
      ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png", "manifest.json", "pass.json", "signature"].sort(),
    );
    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as Record<string, string>;
    for (const [name, hash] of Object.entries(manifest)) {
      expect(createHash("sha1").update(files[name]).digest("hex")).toBe(hash);
    }

    // Check the detached signature the way any PKCS#7 verifier would.
    let openssl = true;
    try {
      execFileSync("openssl", ["version"]);
    } catch {
      openssl = false;
    }
    if (!openssl) return;
    const dir = mkdtempSync(join(tmpdir(), "pkpass-"));
    writeFileSync(join(dir, "manifest.json"), files["manifest.json"]);
    writeFileSync(join(dir, "signature"), files["signature"]);
    writeFileSync(join(dir, "ca.pem"), wwdrPem);
    const out = execFileSync(
      "openssl",
      ["smime", "-verify", "-binary", "-inform", "DER", "-in", join(dir, "signature"), "-content", join(dir, "manifest.json"),
        "-CAfile", join(dir, "ca.pem"), "-purpose", "any", "-out", "/dev/null"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    expect(out).toBeDefined();
  });
});

describe("Google Wallet pass", () => {
  const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(1024);
  const keyFile = JSON.stringify({
    type: "service_account",
    client_email: "wallet@gemledger.iam.gserviceaccount.com",
    private_key: forge.pki.privateKeyToPem(privateKey),
  });

  it("accepts the key file as JSON or base64", () => {
    expect(parseGoogleServiceAccount(keyFile).client_email).toBe("wallet@gemledger.iam.gserviceaccount.com");
    expect(parseGoogleServiceAccount(Buffer.from(keyFile).toString("base64")).client_email).toBe(
      "wallet@gemledger.iam.gserviceaccount.com",
    );
  });

  it("builds a signed save link carrying the passport", () => {
    const creds = { issuerId: "3388000000012345678", serviceAccount: parseGoogleServiceAccount(keyFile) };
    const url = googleSaveUrl(passport, creds, {
      origin: "https://gemledger.example",
      passportUrl: "https://gemledger.example/p/AbCdEfGhIjKlMnOpQrStUv",
      logoUrl: "https://gemledger.example/api/wallet/logo",
    });
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const [header, body, signature] = url.slice("https://pay.google.com/gp/v/save/".length).split(".");
    const ok = verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${body}`),
      createPublicKey(forge.pki.publicKeyToPem(publicKey)),
      Buffer.from(signature, "base64url"),
    );
    expect(ok).toBe(true);
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    expect(claims.typ).toBe("savetowallet");
    expect(claims.payload.genericObjects[0].id).toBe("3388000000012345678.AbCdEfGhIjKlMnOpQrStUv");
    expect(claims.payload.genericObjects[0].classId).toBe(claims.payload.genericClasses[0].id);
    expect(JSON.stringify(claims)).not.toMatch(/price|owner/i);
  });

  it("marks a revoked passport inactive", () => {
    const obj = googleObject({ ...passport, status: "revoked" }, { issuerId: "1", passportUrl: "u", logoUrl: "l" });
    expect(obj.state).toBe("INACTIVE");
  });
});

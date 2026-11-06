import { verificationLabels, type VerificationStatus } from "@gemledger/shared";

export const metalLabel: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum", other: "Other" };
export const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** The public fields of a passport (see get_public_passport). */
export type PassportFacts = {
  public_id: string;
  status: string;
  issued_at: string;
  shop_name: string;
  shop_city: string;
  item_title: string;
  metal: string;
  karat: number | null;
  gross_weight_g: number;
  huids: string[];
  reports: { lab: string; report_number: string; status: VerificationStatus }[];
};

/** Passport details as display text, shared by the web page and both wallet passes. */
export function passportText(p: PassportFacts) {
  const revoked = p.status === "revoked";
  return {
    title: p.item_title,
    shop: `${p.shop_name}, ${p.shop_city}`,
    metal: `${metalLabel[p.metal] ?? p.metal}${p.karat ? ` · ${p.karat}K` : ""}`,
    weight: `${Number(p.gross_weight_g).toFixed(3)} g`,
    huid: p.huids.length ? p.huids.join(", ") : null,
    issued: dateFmt.format(new Date(p.issued_at)),
    revoked,
    status: revoked ? "Revoked" : "Valid",
    reports: p.reports.map((r) => `${r.lab} ${r.report_number}: ${verificationLabels[r.status]}`),
    notice:
      "HUID numbers can be checked independently in the BIS CARE app. GemLedger shows what the jeweller recorded " +
      "and marks a grading report as lab matched only after checking it with the lab.",
  };
}

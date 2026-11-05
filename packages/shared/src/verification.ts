import { z } from "zod";

/**
 * Each piece of evidence on an item carries its own status. These are
 * separate facts shown side by side, never one combined "authenticity" score.
 */
export const VerificationStatus = z.enum([
  "uploaded", // someone uploaded a document; nobody has checked it
  "jeweller_attested", // a verified shop issued and signed this record
  "lab_matched", // the lab's own system confirmed these fields at checkedAt
  "mismatch", // the lab's data disagrees with what was entered
  "not_checkable", // no integration for this lab yet
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const verificationLabels: Record<VerificationStatus, string> = {
  uploaded: "Uploaded",
  jeweller_attested: "Jeweller-attested",
  lab_matched: "Lab-matched",
  mismatch: "Mismatch",
  not_checkable: "Not checkable",
};

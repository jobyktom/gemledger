import { z } from "zod";

/**
 * Public passport IDs go in QR codes, so they must be unguessable.
 * 22 characters of base62 ≈ 131 bits of randomness.
 */
export const PUBLIC_ID_LENGTH = 22;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const PublicPassportId = z
  .string()
  .regex(new RegExp(`^[0-9A-Za-z]{${PUBLIC_ID_LENGTH}}$`), "Invalid passport ID");

export function newPublicPassportId(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  let out = "";
  while (out.length < PUBLIC_ID_LENGTH) {
    for (const b of randomBytes(32)) {
      // Rejection sampling keeps the distribution uniform: 248 = 62 * 4.
      if (b < 248 && out.length < PUBLIC_ID_LENGTH) out += BASE62[b % 62];
    }
  }
  return out;
}

export const PassportStatus = z.enum(["issued", "claimed", "transferred", "revoked"]);
export type PassportStatus = z.infer<typeof PassportStatus>;

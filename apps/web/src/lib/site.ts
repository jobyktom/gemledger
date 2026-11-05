import "server-only";
import { headers } from "next/headers";

/**
 * Public origin used in QR codes. Set NEXT_PUBLIC_SITE_URL in production so
 * printed codes never point at a preview or localhost URL.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  // Local and LAN addresses (localhost, 192.168.x.x:3000) serve plain http.
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

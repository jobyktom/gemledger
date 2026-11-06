import { googleLogoPng } from "@/lib/wallet/images";

/** The logo Google Wallet shows on GemLedger cards (Google fetches it by URL). */
export function GET() {
  return new Response(Buffer.from(googleLogoPng, "base64"), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}

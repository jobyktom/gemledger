/**
 * The address the visitor actually used, for building redirects.
 *
 * Behind Hostinger's proxy, Next.js sees itself as https://0.0.0.0:3000, so
 * request.nextUrl.origin sends people to an address their browser can't reach.
 * The proxy passes the real host in x-forwarded-host (or host), so use that.
 */
export function publicOrigin(request: { headers: Headers; nextUrl: { origin: string } }): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  if (!host || /^0\.0\.0\.0(:|$)/.test(host)) return request.nextUrl.origin;
  // Local and LAN addresses (localhost, 192.168.x.x:3000) serve plain http.
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** Same path and query as `url`, on the visitor's real origin. */
export function publicUrl(request: { headers: Headers; nextUrl: { origin: string } }, url: URL | string): URL {
  const u = new URL(url, request.nextUrl.origin);
  return new URL(u.pathname + u.search + u.hash, publicOrigin(request));
}

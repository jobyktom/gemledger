import { timingSafeEqual } from "node:crypto";
import { PublicPassportId } from "@gemledger/shared";
import { loadPublicPassport } from "@/lib/passport";
import { createClient } from "@/lib/supabase/server";
import { applePassFor, applePassMeta, pkpassResponse } from "@/lib/wallet/apple";
import { appleWallet } from "@/lib/wallet/config";

/*
 * Apple Wallet's web service, which iPhones call by themselves:
 *   POST   v1/devices/{device}/registrations/{passTypeId}/{serial}  start updates
 *   DELETE v1/devices/{device}/registrations/{passTypeId}/{serial}  stop updates
 *   GET    v1/devices/{device}/registrations/{passTypeId}           which passes changed
 *   GET    v1/passes/{passTypeId}/{serial}                          latest pass
 *   POST   v1/log                                                   errors from the phone
 * The serial number is the passport's public ID. See Apple's "Wallet Passes" web service reference.
 */

type Ctx = RouteContext<"/api/wallet/apple/v1/[...path]">;

const DeviceId = /^[A-Za-z0-9._-]{1,128}$/;
const PushToken = /^[A-Za-z0-9]{1,200}$/;
const status = (code: number) => new Response(null, { status: code });

function sameToken(given: string | null, expected: string) {
  if (!given?.startsWith("ApplePass ")) return false;
  const a = Buffer.from(given.slice("ApplePass ".length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function route(request: Request, ctx: Ctx) {
  const creds = appleWallet();
  if (!creds) return status(404);
  const path = (await ctx.params).path;
  const method = request.method;

  if (method === "POST" && path.length === 1 && path[0] === "log") {
    const body = (await request.json().catch(() => null)) as { logs?: unknown } | null;
    if (Array.isArray(body?.logs)) console.warn("Apple Wallet:", body.logs.slice(0, 10).map(String).join(" | ").slice(0, 2000));
    return status(200);
  }

  if (path[0] === "passes" && path.length === 3 && method === "GET") {
    const [, passTypeId, serial] = path;
    if (passTypeId !== creds.passTypeId || !PublicPassportId.safeParse(serial).success) return status(404);
    const meta = await applePassMeta(serial);
    if (!meta) return status(404);
    if (!sameToken(request.headers.get("authorization"), meta.token)) return status(401);
    const since = Date.parse(request.headers.get("if-modified-since") ?? "");
    if (!Number.isNaN(since) && Math.floor(meta.updatedAt.getTime() / 1000) <= Math.floor(since / 1000)) return status(304);
    const passport = await loadPublicPassport(serial);
    const pass = passport && (await applePassFor(passport, creds));
    return pass ? pkpassResponse(pass) : status(404);
  }

  if (path[0] !== "devices" || path[2] !== "registrations" || path[3] !== creds.passTypeId) return status(404);
  const device = path[1];
  if (!DeviceId.test(device)) return status(400);
  const supabase = await createClient();

  if (path.length === 4 && method === "GET") {
    const tag = new URL(request.url).searchParams.get("passesUpdatedSince");
    const since = tag && !Number.isNaN(Date.parse(tag)) ? new Date(tag).toISOString() : undefined;
    const { data, error } = await supabase.rpc("wallet_apple_device_passes", { p_device: device, p_since: since });
    if (error) return status(500);
    if (!data?.length) return status(204);
    const lastUpdated = data.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), data[0].updated_at);
    return Response.json({ serialNumbers: data.map((r) => r.public_id), lastUpdated: new Date(lastUpdated).toISOString() });
  }

  if (path.length !== 5) return status(404);
  const serial = path[4];
  if (!PublicPassportId.safeParse(serial).success) return status(404);
  const token = request.headers.get("authorization")?.replace(/^ApplePass /, "") ?? "";

  if (method === "POST") {
    const body = (await request.json().catch(() => null)) as { pushToken?: unknown } | null;
    const pushToken = typeof body?.pushToken === "string" ? body.pushToken : "";
    if (!PushToken.test(pushToken)) return status(400);
    const { data, error } = await supabase.rpc("wallet_apple_register", {
      p_public_id: serial,
      p_token: token,
      p_device: device,
      p_push_token: pushToken,
    });
    if (error) return status(500);
    return status(data === "created" ? 201 : data === "exists" ? 200 : 401);
  }

  if (method === "DELETE") {
    const { data, error } = await supabase.rpc("wallet_apple_unregister", { p_public_id: serial, p_token: token, p_device: device });
    if (error) return status(500);
    return status(data ? 200 : 401);
  }
  return status(405);
}

export const GET = route;
export const POST = route;
export const DELETE = route;

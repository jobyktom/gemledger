import { NextResponse, type NextRequest } from "next/server";
import { STAFF_SESSION_SECONDS, getSecondsSinceSignIn } from "@/lib/auth";
import { publicOrigin } from "@/lib/public-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends a staff session that has run past its 12 hours, then shows the login
 * page. Does nothing for a session still within its time, so a link from
 * another site can't sign people out.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  if ((await getSecondsSinceSignIn()) <= STAFF_SESSION_SECONDS) {
    return NextResponse.redirect(new URL("/portal", origin));
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=expired", origin));
}

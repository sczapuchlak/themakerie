import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where `requireOwner()` sends a signed-in account that isn't the authorized
 * owner: end that session, then explain on the sign-in screen.
 *
 * It only signs out sessions that genuinely lack access, so a link to this
 * URL from elsewhere can't be used to sign the owner out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  let destination = "/sign-in?error=not-authorized";

  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    const { data: authorized } = data?.claims
      ? await supabase.rpc("is_authorized_account")
      : { data: false };
    if (authorized === true) destination = "/";
    else if (data?.claims) await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return response;
}

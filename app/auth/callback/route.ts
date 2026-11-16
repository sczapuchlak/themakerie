import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { NEXT_PATH_COOKIE, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth return leg. Exchanges the PKCE code for a session, then admits the
 * account only if its *id* is on the owner allowlist; anyone else is signed
 * straight back out.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const cookieStore = await cookies();
  const next = safeNextPath(cookieStore.get(NEXT_PATH_COOKIE)?.value);
  cookieStore.delete(NEXT_PATH_COOKIE);

  if (!code || searchParams.get("error")) {
    return redirectTo(request, "/sign-in?error=oauth");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectTo(request, "/sign-in?error=unconfigured");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectTo(request, "/sign-in?error=oauth");

  const { data: authorized } = await supabase.rpc("is_authorized_account");
  if (authorized !== true) {
    await supabase.auth.signOut();
    return redirectTo(request, "/sign-in?error=not-authorized");
  }

  return redirectTo(request, next);
}

function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  // Carries auth cookies — must never be cached.
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return response;
}

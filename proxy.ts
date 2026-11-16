import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Runs before every page request:
 *   1. refreshes the Supabase session so cookies stay valid (this is what
 *      keeps the owner signed in across PWA reopenings), and
 *   2. optimistically sends visitors without a session to /sign-in.
 *
 * This is NOT the authorization boundary — `requireOwner()` in the data
 * access layer and database RLS are. Proxy only avoids rendering work for
 * obviously signed-out requests.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/sign-in" || pathname.startsWith("/auth/");

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    // Unconfigured deployment (e.g. Vercel Preview): only sign-in is reachable.
    return isPublic ? NextResponse.next() : redirectToSignIn(request);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Validates the JWT and refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublic) {
    const redirect = redirectToSignIn(request);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/sign-in";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization and app icons.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Data Access Layer for authentication and authorization.
 *
 * Every protected read or Server Function must go through `requireOwner()` (or
 * `getAccess()`); hidden navigation and proxy.ts redirects are conveniences,
 * not security. Database row-level security is the final backstop.
 */

export type Owner = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type Access =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "unauthorized" }
  | { status: "authorized"; owner: Owner };

/**
 * Verifies the session server-side (getClaims checks the JWT signature, it
 * doesn't just trust the cookie) and then asks the database whether this
 * *account id* is the authorized owner. Memoized per request.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { status: "signed-out" };

  const { data: authorized, error: rpcError } = await supabase.rpc("is_authorized_account");
  if (rpcError || authorized !== true) return { status: "unauthorized" };

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    status: "authorized",
    owner: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      name: asString(meta.full_name) ?? asString(meta.name),
      avatarUrl: asString(meta.avatar_url) ?? asString(meta.picture),
    },
  };
});

/**
 * Returns the authorized owner or redirects: signed-out visitors to sign-in,
 * signed-in but unauthorized accounts to /auth/denied (which signs them out).
 */
export async function requireOwner(): Promise<Owner> {
  const access = await getAccess();
  if (access.status === "authorized") return access.owner;
  if (access.status === "unauthorized") redirect("/auth/denied");
  redirect("/sign-in");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

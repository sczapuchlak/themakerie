import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Server Supabase client for Server Components, Server Functions and Route
 * Handlers. Create one per request — never share it across requests.
 * Returns null when Supabase isn't configured for this deployment.
 */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't write cookies. proxy.ts refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}

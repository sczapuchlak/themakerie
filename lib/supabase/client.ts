import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Browser Supabase client for Client Components. Uses only the publishable
 * key; the session lives in cookies shared with the server client.
 * Returns null when Supabase isn't configured for this deployment.
 */
export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient<Database>(config.url, config.publishableKey);
}

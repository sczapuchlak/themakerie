/**
 * Supabase connection settings.
 *
 * Both values are *publishable* — safe in the browser, because row-level
 * security and the owner allowlist protect the data. The app never reads a
 * secret or service-role key.
 *
 * When they are absent (Vercel Preview deployments are deliberately left
 * unconnected to production), auth is disabled: every private route resolves
 * to the sign-in screen, and there is nothing to read or write.
 */
export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  // Referenced statically so Next.js can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  assertPublishable(publishableKey);
  return { url, publishableKey };
}

/**
 * NEXT_PUBLIC_ values ship to every browser. Fail loudly if a secret key was
 * pasted into the publishable slot by mistake.
 */
function assertPublishable(key: string) {
  if (key.startsWith("sb_secret_")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the publishable key.");
  }
  const payload = key.split(".")[1];
  if (payload) {
    try {
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
      if (claims.role === "service_role") {
        throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a service-role key. Use the anon/publishable key.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("service-role")) throw error;
    }
  }
}

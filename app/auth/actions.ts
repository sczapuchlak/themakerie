"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NEXT_PATH_COOKIE, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------- Google */

/** Primary sign-in: Google OAuth (PKCE) via Supabase. */
export async function signInWithGoogle(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in?error=unconfigured");

  // Carry the destination in a short-lived cookie so the OAuth redirect URL
  // stays an exact match for Supabase's allow-list.
  (await cookies()).set(NEXT_PATH_COOKIE, safeNextPath(formData.get("next")), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
      // Always show the account chooser, so the right Google account is used.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/sign-in?error=oauth");
  redirect(data.url);
}

/* ------------------------------------------------- Email code (backup) */

export type EmailCodeState = {
  step: "email" | "code";
  email?: string;
  message?: string;
  error?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6}$/;

/**
 * Backup sign-in with a 6-digit email code. `shouldCreateUser: false` means
 * it can only ever sign in an account that already exists — never register
 * one. Responses don't reveal whether an address belongs to the owner.
 */
export async function emailCodeAction(
  _previous: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const intent = formData.get("intent");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (intent === "reset") return { step: "email" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { step: "email", error: "Sign-in isn't available on this deployment." };

  if (intent === "send") {
    if (!EMAIL.test(email)) return { step: "email", email, error: "Enter a valid email address." };

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error?.status === 429) {
      return { step: "email", email, error: "Too many attempts. Wait a minute and try again." };
    }
    return {
      step: "code",
      email,
      message: "If this address belongs to the studio's owner, a 6-digit code is on its way.",
    };
  }

  if (intent === "verify") {
    const token = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!EMAIL.test(email)) return { step: "email", error: "Enter a valid email address." };
    if (!CODE.test(token)) return { step: "code", email, error: "Enter the 6-digit code from the email." };

    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      return { step: "code", email, error: "That code didn't work. Check it, or send a new one." };
    }

    const { data: authorized } = await supabase.rpc("is_authorized_account");
    if (authorized !== true) {
      await supabase.auth.signOut();
      return { step: "email", error: "This account doesn't have access to The Makerie." };
    }
    redirect(safeNextPath(formData.get("next")));
  }

  return { step: "email" };
}

/* ------------------------------------------------------------ Sign out */

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/sign-in");
}

/* ------------------------------------------------------------- helpers */

async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

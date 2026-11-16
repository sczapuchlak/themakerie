import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Wordmark } from "@/components/brand/wordmark";
import { Starburst } from "@/components/motifs/starburst";
import { getAccess } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't finish. Please try again.",
  "not-authorized":
    "That account doesn't have access to The Makerie. Sign in with the studio owner's account.",
  unconfigured: "Sign-in isn't set up on this deployment.",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main
      id="main"
      className="gutter flex min-h-dvh items-center justify-center pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid w-full max-w-[60rem] overflow-hidden rounded-panel shadow-[0_32px_64px_-32px_rgb(8_22_56/0.55)] lg:grid-cols-12">
        {/* Brand panel */}
        <section className="tone-midnight surface-midnight relative flex flex-col p-7 sm:p-10 lg:col-span-5">
          <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
          <div className="relative">
            <Wordmark />
          </div>
          <div className="relative mt-10 lg:mt-auto">
            <p className="eyebrow flex items-center gap-2">
              <Starburst className="size-2.5 text-spark" />
              Private studio
            </p>
            <h1 className="mt-4 font-display-tight text-[clamp(2.4rem,6vw,3.6rem)]">
              Sign in to your{" "}
              <span className="font-serif font-normal tracking-normal text-vivid italic">studio.</span>
            </h1>
            <p className="mt-4 max-w-xs leading-relaxed text-body">
              The Makerie is a private workspace. Only its owner can come in.
            </p>
          </div>
          <div aria-hidden="true" className="holo-spectrum relative mt-8 h-[3px] w-24 rounded-full" />
        </section>

        {/* Sign-in panel */}
        <section aria-label="Sign-in options" className="bg-paper p-7 sm:p-10 lg:col-span-7">
          <Suspense fallback={<SignInOptions next="/" />}>
            <SignInWithParams searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

async function SignInWithParams({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);

  const access = await getAccess();
  if (access.status === "authorized") redirect(next);

  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const error = access.status === "unconfigured" ? ERRORS.unconfigured : errorKey ? ERRORS[errorKey] : undefined;

  return <SignInOptions next={next} error={error} disabled={access.status === "unconfigured"} />;
}

function SignInOptions({ next, error, disabled = false }: { next: string; error?: string; disabled?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <p className="eyebrow">Welcome back</p>
      <h2 className="mt-3 font-display-tight text-[1.9rem]">Choose how to sign in</h2>

      {error && (
        <p role="alert" className="mt-5 rounded-tile border border-[#b0124f]/25 bg-[#fde7f1] px-4 py-3 text-sm font-medium text-[#8a0c3d]">
          {error}
        </p>
      )}

      <div className="mt-7">
        <GoogleSignIn next={next} disabled={disabled} />
      </div>

      <details className="group mt-6 rounded-card border border-line bg-white/60 px-5 py-4 open:pb-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-strong">
          Use an email code instead
          <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="mt-3">
          <EmailCodeForm next={next} disabled={disabled} />
        </div>
      </details>

      <p className="mt-auto pt-8 text-xs leading-relaxed text-muted">
        There&rsquo;s no public sign-up. Access is limited to the studio&rsquo;s owner account.
      </p>
    </div>
  );
}

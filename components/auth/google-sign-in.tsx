"use client";

import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/app/auth/actions";

/** Primary sign-in. Posts to a Server Function that starts the OAuth flow. */
export function GoogleSignIn({ next, disabled = false }: { next: string; disabled?: boolean }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-midnight px-6 text-[0.95rem] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(8_22_56/0.7)] transition-transform duration-200 ease-soft hover:-translate-y-px disabled:translate-y-0 disabled:opacity-60"
    >
      <span className="grid size-7 place-items-center rounded-full bg-white">
        <GoogleMark />
      </span>
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[1.1rem]" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

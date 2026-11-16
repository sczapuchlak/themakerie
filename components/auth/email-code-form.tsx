"use client";

import { useActionState } from "react";
import { emailCodeAction, type EmailCodeState } from "@/app/auth/actions";

const initialState: EmailCodeState = { step: "email" };

/**
 * Backup sign-in with a 6-digit email code. The code is typed in place, so
 * it works inside the installed iPhone app (no link that opens Safari).
 */
export function EmailCodeForm({ next, disabled = false }: { next: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(emailCodeAction, initialState);

  if (state.step === "code") {
    return (
      <form action={action} className="space-y-3">
        <input type="hidden" name="email" value={state.email ?? ""} />
        <input type="hidden" name="next" value={next} />
        {state.message && <p className="text-sm leading-relaxed text-body">{state.message}</p>}
        <label className="block">
          <span className="eyebrow">6-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="mt-2 block w-full rounded-tile border border-line-strong bg-white px-4 py-3 font-mono text-2xl tracking-[0.5em] text-strong outline-none focus:border-midnight"
          />
        </label>
        {state.error && <ErrorText>{state.error}</ErrorText>}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" name="intent" value="verify" disabled={pending} className="btn btn-secondary">
            {pending ? "Checking…" : "Sign in with code"}
          </button>
          <button
            type="submit"
            name="intent"
            value="reset"
            formNoValidate
            className="min-h-11 text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="eyebrow">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          disabled={disabled}
          className="mt-2 block w-full rounded-tile border border-line-strong bg-white px-4 py-3 text-strong outline-none focus:border-midnight"
        />
      </label>
      {state.error && <ErrorText>{state.error}</ErrorText>}
      <button
        type="submit"
        name="intent"
        value="send"
        disabled={disabled || pending}
        className="btn btn-secondary"
      >
        {pending ? "Sending…" : "Email me a code"}
      </button>
    </form>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-[#b0124f]">
      {children}
    </p>
  );
}

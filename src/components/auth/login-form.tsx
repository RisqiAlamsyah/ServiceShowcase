"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginAction } from "@/actions/auth";
import { TextField } from "@/components/ui/text-field";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Fokus pindah ke kolom bermasalah pertama (atau ke pesan galat umum) setelah submit gagal.
  useEffect(() => {
    if (!state || state.ok) return;
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  }, [state]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField
        id="login-email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        errors={fieldErrors?.email}
        maxLength={254}
      />
      <TextField
        id="login-password"
        name="password"
        type="password"
        label="Sandi"
        autoComplete="current-password"
        errors={fieldErrors?.password}
        maxLength={128}
      />

      <div aria-live="polite">
        {state && !state.ok && !hasFieldErrors ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}

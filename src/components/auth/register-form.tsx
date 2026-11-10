"use client";

import { useActionState, useEffect, useRef } from "react";
import { registerAction } from "@/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state.ok) return;
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  }, [state]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <TextField
        id="register-name"
        name="name"
        label="Nama"
        autoComplete="name"
        errors={fieldErrors?.name}
        maxLength={60}
      />
      <TextField
        id="register-email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        errors={fieldErrors?.email}
        maxLength={254}
      />
      <TextField
        id="register-password"
        name="password"
        type="password"
        label="Sandi"
        autoComplete="new-password"
        hint={`Minimal ${PASSWORD_MIN} karakter. Kalimat panjang lebih kuat daripada kata acak.`}
        errors={fieldErrors?.password}
        maxLength={PASSWORD_MAX}
      />
      <TextField
        id="register-confirm"
        name="confirmPassword"
        type="password"
        label="Ulangi sandi"
        autoComplete="new-password"
        errors={fieldErrors?.confirmPassword}
        maxLength={PASSWORD_MAX}
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
        {pending ? "Memproses…" : "Daftar"}
      </button>
    </form>
  );
}

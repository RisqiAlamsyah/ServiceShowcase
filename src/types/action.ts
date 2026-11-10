// Hasil seragam Server Action (RULES §5). `message` aman dibaca pengguna dan tanpa detail internal.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "RATE_LIMITED"
        | "CONFLICT"
        | "INTERNAL";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

// Nilai isian (string) yang dikembalikan ke form agar tidak hilang saat React me-reset form
// setelah action selesai. Hanya data non-rahasia; jangan pernah menyertakan sandi.
export type FormValues = Record<string, string>;

export type FormState<T = void> = (ActionResult<T> & { values?: FormValues }) | null;

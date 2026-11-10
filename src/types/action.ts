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

// Hasil operasi domain murni (tanpa melempar error untuk input yang salah).
// Berbeda dari ActionResult (RULES §5) yang dipakai di batas Server Action.
export type Result<T, C extends string = string> =
  { ok: true; data: T } | { ok: false; code: C; message: string };

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail<C extends string>(
  code: C,
  message: string,
): { ok: false; code: C; message: string } {
  return { ok: false, code, message };
}

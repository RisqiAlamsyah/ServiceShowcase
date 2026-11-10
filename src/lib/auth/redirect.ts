// Mencegah open redirect (RULES_SECURITY §2.6): hanya path relatif satu-origin yang diterima.
const MAX_LENGTH = 200;

export function safeRedirectPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return fallback;
  // Harus diawali satu "/", bukan "//" (protocol-relative) atau "/\" (dinormalisasi browser jadi "//").
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Tolak karakter kontrol, backslash, dan skema tersembunyi.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  // Jangan mengarahkan balik ke halaman auth (mencegah loop).
  if (/^\/(masuk|daftar)(\/|\?|#|$)/.test(raw)) return fallback;
  return raw;
}

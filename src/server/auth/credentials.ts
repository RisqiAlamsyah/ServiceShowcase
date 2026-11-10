import "server-only";
import { loginSchema } from "@/lib/validation/auth";
import { verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { RATE_RULES, clientIp, consume } from "@/server/auth/rate-limit";
import { findUserForLogin } from "@/server/user/service";

export type AuthorizedUser = { id: string; email: string; name: string | null };

// Dipanggil dari `authorize` Auth.js, juga oleh endpoint /api/auth/callback/credentials, jadi
// rate limit ada di sini (bukan hanya di Server Action). Semua jalur gagal mengembalikan null
// (pesan generik, tidak membedakan penyebab).
export async function authorizeCredentials(
  raw: Partial<Record<string, unknown>>,
  headers: Headers,
): Promise<AuthorizedUser | null> {
  // Auth.js menambahkan field lain ke data kredensial (mis. callbackUrl, csrfToken). Ambil hanya
  // yang dikenal; skema `.strict()` akan menolak semuanya bila objek mentah diteruskan.
  const parsed = loginSchema.safeParse({ email: raw.email, password: raw.password });
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const ip = clientIp(headers);
  const [okEmail, okIp] = await Promise.all([
    consume("login:email", email, RATE_RULES.loginEmail),
    consume("login:ip", ip, RATE_RULES.loginIp),
  ]);
  if (!okEmail || !okIp) return null;

  const user = await findUserForLogin(email);
  // Akun tanpa sandi (mis. Google SSO nanti) tidak bisa masuk lewat form ini. Hash tiruan
  // menyamakan waktu respons saat email tidak terdaftar (anti-enumerasi).
  const valid = user?.passwordHash
    ? await verifyPassword(user.passwordHash, password)
    : await verifyAgainstDummy(password);
  if (!user || !valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}

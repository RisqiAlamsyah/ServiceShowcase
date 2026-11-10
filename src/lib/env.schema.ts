import { z } from "zod";

// Skema murni (tanpa "server-only") agar bisa diuji. Pembaca process.env ada di env.ts / env.client.ts.
// Fitur berikutnya menambah variabel di sini (DATABASE_URL, AUTH_SECRET, R2_*, dst.).

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Koneksi pooled untuk runtime. DIRECT_URL (migrasi) sengaja tidak ada di sini: hanya dibaca
  // prisma.config.ts, supaya kredensial DDL tidak pernah ada di runtime aplikasi.
  DATABASE_URL: z.string().refine((v) => /^postgres(ql)?:\/\//.test(v), "harus URL PostgreSQL"),
});

export const clientEnvSchema = z.object({
  // Hanya nilai publik. Dilarang menaruh rahasia di NEXT_PUBLIC_*.
  NEXT_PUBLIC_SITE_URL: z.url().refine((v) => !v.endsWith("/"), "tanpa garis miring di akhir"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    // Hanya nama variabel yang dicetak, tidak pernah nilainya.
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Konfigurasi environment server tidak valid: ${names}`);
  }
  return result.data;
}

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  const result = clientEnvSchema.safeParse(raw);
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Konfigurasi environment publik tidak valid: ${names}`);
  }
  return result.data;
}

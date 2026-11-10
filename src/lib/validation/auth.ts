import { z } from "zod";
import { COMMON_PASSWORDS } from "@/lib/auth/common-passwords";

export const PASSWORD_MIN = 12;
// Batas atas melindungi server dari beban hashing berlebih, bukan pembatasan kreativitas pengguna.
export const PASSWORD_MAX = 128;

const NAME_PATTERN = /^[\p{L}\p{M}0-9 .,'’-]+$/u;

const emailField = z
  .string()
  .max(254, "Email terlalu panjang.")
  .transform((v) => v.normalize("NFC").trim().toLowerCase())
  .pipe(z.email("Email tidak valid."));

const newPasswordField = z
  .string()
  .min(PASSWORD_MIN, `Sandi minimal ${PASSWORD_MIN} karakter.`)
  .max(PASSWORD_MAX, `Sandi maksimal ${PASSWORD_MAX} karakter.`)
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "Sandi terlalu umum. Pilih yang lain.")
  .refine((v) => new Set(v).size > 3, "Sandi terlalu mudah ditebak.");

export const registerSchema = z
  .object({
    name: z
      .string()
      .max(200, "Nama terlalu panjang.")
      .transform((v) => v.normalize("NFC").replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(2, "Nama minimal 2 karakter.")
          .max(60, "Nama maksimal 60 karakter.")
          .regex(NAME_PATTERN, "Nama hanya boleh huruf, angka, spasi, dan . , ' -"),
      ),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string().max(PASSWORD_MAX, "Sandi terlalu panjang."),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi sandi tidak sama.",
  })
  .refine((v) => v.password.toLowerCase() !== v.email, {
    path: ["password"],
    message: "Sandi tidak boleh sama dengan email.",
  });

export const loginSchema = z
  .object({
    email: emailField,
    // Login tidak menerapkan aturan sandi baru (akun lama tetap bisa masuk); hanya batas ukuran.
    password: z.string().min(1, "Isi sandi.").max(PASSWORD_MAX, "Sandi terlalu panjang."),
    next: z.string().max(200).optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

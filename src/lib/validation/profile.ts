import { z } from "zod";
import { normalizeWhatsAppNumber } from "@/lib/booking/whatsapp";
import { RESERVED_SLUGS } from "@/lib/profile/reserved-slugs";

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

const BUSINESS_NAME_PATTERN = /^[\p{L}\p{M}0-9 .,&'’()/-]+$/u;

// Huruf kecil, angka, dan tanda hubung; tidak diawali/diakhiri tanda hubung dan tanpa "--".
export const slugSchema = z
  .string()
  .max(100, "Slug terlalu panjang.")
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(SLUG_MIN, `Slug minimal ${SLUG_MIN} karakter.`)
      .max(SLUG_MAX, `Slug maksimal ${SLUG_MAX} karakter.`)
      .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung.")
      .refine(
        (v) => !v.startsWith("-") && !v.endsWith("-"),
        "Slug tidak boleh diawali atau diakhiri tanda hubung.",
      )
      .refine((v) => !v.includes("--"), "Slug tidak boleh memuat dua tanda hubung berurutan.")
      .refine((v) => !RESERVED_SLUGS.has(v), "Slug ini tidak tersedia. Pilih yang lain."),
  );

const whatsappSchema = z
  .string()
  .max(30, "Nomor WhatsApp terlalu panjang.")
  .transform((v, ctx) => {
    const result = normalizeWhatsAppNumber(v);
    if (!result.ok) {
      ctx.addIssue({
        code: "custom",
        message: "Nomor WhatsApp tidak valid. Contoh: 08123456789 atau +62 812-3456-7890.",
      });
      return z.NEVER;
    }
    return result.data;
  });

export const saveProfileSchema = z
  .object({
    businessName: z
      .string()
      .max(200, "Nama bisnis terlalu panjang.")
      .transform((v) => v.normalize("NFC").replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(2, "Nama bisnis minimal 2 karakter.")
          .max(100, "Nama bisnis maksimal 100 karakter.")
          .regex(BUSINESS_NAME_PATTERN, "Nama bisnis memuat karakter yang tidak diizinkan."),
      ),
    whatsapp: whatsappSchema,
    // Kosong berarti tanpa bio. Baris baru dilipat jadi spasi agar tampil rapi di halaman publik.
    bio: z
      .string()
      .max(1000, "Bio terlalu panjang.")
      .transform((v) =>
        v
          .normalize("NFC")
          .replace(/[\p{Cc}\p{Cf}]/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .pipe(z.string().max(500, "Bio maksimal 500 karakter."))
      .transform((v) => (v.length === 0 ? null : v)),
    slug: slugSchema,
    // Kotak centang konfirmasi saat mengganti slug yang sudah ada ("on" bila dicentang).
    confirmSlugChange: z.enum(["on"]).optional(),
  })
  .strict();

export type SaveProfileInput = z.infer<typeof saveProfileSchema>;

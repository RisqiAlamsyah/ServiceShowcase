import { z } from "zod";
import { parseRupiahInput } from "@/lib/money";

// Nama paket/add-on: huruf (Unicode), angka, spasi, dan tanda baca umum. Teks ini ikut ke pesan
// WhatsApp (dibersihkan lagi di sana), jadi karakter kontrol dan markup ditolak sejak awal.
const LABEL_PATTERN = /^[\p{L}\p{M}0-9 .,&'’()/+-]+$/u;

function label(field: string, max: number) {
  return z
    .string()
    .max(max * 2, `${field} terlalu panjang.`)
    .transform((v) => v.normalize("NFC").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, `${field} minimal 2 karakter.`)
        .max(max, `${field} maksimal ${max} karakter.`)
        .regex(LABEL_PATTERN, `${field} memuat karakter yang tidak diizinkan.`),
    );
}

const priceSchema = z
  .string()
  .max(30, "Harga terlalu panjang.")
  .transform((v, ctx) => {
    const price = parseRupiahInput(v);
    if (price === null) {
      ctx.addIssue({
        code: "custom",
        message: "Harga tidak valid. Contoh: 2500000 atau 2.500.000.",
      });
      return z.NEVER;
    }
    return price;
  });

const descriptionSchema = z
  .string()
  .max(1000, "Deskripsi terlalu panjang.")
  .transform((v) =>
    v
      .normalize("NFC")
      .replace(/[\p{Cc}\p{Cf}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
  .pipe(z.string().max(500, "Deskripsi maksimal 500 karakter."));

const idSchema = z.cuid("Data tidak valid.");

export const packageFieldsSchema = z
  .object({
    title: label("Nama paket", 100),
    description: descriptionSchema,
    basePrice: priceSchema,
  })
  .strict();

export const updatePackageSchema = packageFieldsSchema.extend({ id: idSchema }).strict();

export const addonFieldsSchema = z
  .object({
    name: label("Nama add-on", 100),
    price: priceSchema,
  })
  .strict();

export const createAddonSchema = addonFieldsSchema.extend({ packageId: idSchema }).strict();
export const updateAddonSchema = addonFieldsSchema.extend({ id: idSchema }).strict();

export const idOnlySchema = z.object({ id: idSchema }).strict();
export { idSchema };

export type PackageFields = z.infer<typeof packageFieldsSchema>;
export type AddonFields = z.infer<typeof addonFieldsSchema>;

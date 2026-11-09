import { z } from "zod";
import { isBeforeIsoDate, isValidIsoDate, parseIsoDate } from "@/lib/booking/date";
import { MAX_ADDONS } from "@/lib/booking/types";

// Nama pemesan: huruf (termasuk aksen/Unicode), angka, spasi, dan . , ' ’ - saja.
// Tanpa <, >, &, =, #, %, +, emoji, atau karakter kontrol.
const NAME_PATTERN = /^[\p{L}\p{M}0-9 .,'’-]+$/u;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_YEARS_AHEAD = 3;

// Baris baru/tab menjadi spasi tunggal (tidak ditolak, tetapi tidak bisa menyisipkan baris pesan).
export function normalizeClientName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

// `todayIso` (YYYY-MM-DD, WIB) diberikan pemanggil agar fungsi ini tetap murni dan mudah diuji.
export function createBookingInputSchema(todayIso: string) {
  const todayYear = parseIsoDate(todayIso)?.year ?? 0;

  return z
    .object({
      clientName: z
        .string()
        .max(200, "Nama terlalu panjang.")
        .transform(normalizeClientName)
        .pipe(
          z
            .string()
            .min(2, "Nama minimal 2 karakter.")
            .max(60, "Nama maksimal 60 karakter.")
            .regex(NAME_PATTERN, "Nama hanya boleh huruf, angka, spasi, dan . , ' -"),
        ),
      eventDate: z
        .string()
        .min(1, "Pilih tanggal acara.")
        .refine(isValidIsoDate, "Tanggal tidak valid.")
        .refine((d) => !isBeforeIsoDate(d, todayIso), "Tanggal acara tidak boleh sudah lewat.")
        .refine(
          (d) => (parseIsoDate(d)?.year ?? 0) <= todayYear + MAX_YEARS_AHEAD,
          "Tanggal acara terlalu jauh.",
        ),
      packageId: z.string().regex(ID_PATTERN, "Paket tidak valid."),
      addonIds: z.array(z.string().regex(ID_PATTERN, "Add-on tidak valid.")).max(MAX_ADDONS),
    })
    .strict();
}

export type BookingInput = z.infer<ReturnType<typeof createBookingInputSchema>>;

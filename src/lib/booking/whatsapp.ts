import { formatRupiah } from "@/lib/money";
import { fail, ok, type Result } from "@/types/result";
import { formatIdDate } from "./date";
import type { Estimate } from "./types";

const MAX_LABEL_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
// Indonesia (kode 62): digit pertama nasional 1-9, lalu 8-13 digit lagi (aturan lebih ketat).
const ID_PHONE = /^62[1-9]\d{7,12}$/;
// Negara lain mengikuti E.164: 8-15 digit total, digit pertama 1-9 (tanpa "+" dan tanpa nol di depan).
const INTL_PHONE = /^[1-9]\d{7,14}$/;

export type PhoneErrorCode = "INVALID_PHONE";
export type UrlErrorCode = PhoneErrorCode | "MESSAGE_TOO_LONG";

// Hasil selalu berupa digit internasional tanpa "+" (format yang dipakai wa.me).
//  - Indonesia: "08123456789", "+62 812-3456-789", "628123456789" -> "628123456789"
//  - Negara lain wajib diawali "+" atau "00": "+1 415 555 2671", "0044 20 7946 0958" -> "14155552671", "442079460958"
// Angka telanjang yang bukan 62/0 (mis. "8123456789") DITOLAK, bukan ditebak: bisa salah terbaca
// sebagai kode negara lain dan pesan terkirim ke orang yang salah.
export function normalizeWhatsAppNumber(raw: string): Result<string, PhoneErrorCode> {
  const invalid = fail("INVALID_PHONE", "Nomor WhatsApp tidak valid.");
  if (raw.length === 0 || raw.length > 30) return invalid;

  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return invalid;

  let digits: string;
  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (compact.startsWith("0")) {
    digits = `62${compact.slice(1)}`; // nomor lokal Indonesia: 08xx -> 628xx
  } else if (compact.startsWith("62")) {
    digits = compact;
  } else {
    return invalid;
  }

  const valid = digits.startsWith("62") ? ID_PHONE.test(digits) : INTL_PHONE.test(digits);
  return valid ? ok(digits) : invalid;
}

// Teks dari pihak lain (nama paket, nama klien) tidak boleh menyisipkan baris baru atau karakter kontrol
// ke dalam pesan: semuanya jadi spasi, lalu spasi berulang dilipat.
export function cleanMessageText(value: string, maxLength: number = MAX_LABEL_LENGTH): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export type WhatsAppMessageInput = {
  clientName: string;
  /** "YYYY-MM-DD" yang sudah divalidasi. */
  eventDate: string;
  estimate: Estimate;
};

// Format persis FRS 4.1.
export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  const { clientName, eventDate, estimate } = input;

  const lines = [
    "Halo kak!",
    "Saya mau booking jasa untuk:",
    "",
    `Nama: ${cleanMessageText(clientName, 60)}`,
    `Tanggal: ${formatIdDate(eventDate)}`,
    `Paket: ${cleanMessageText(estimate.package.label)} (${formatRupiah(estimate.package.price)})`,
  ];

  if (estimate.addons.length > 0) {
    lines.push("Add-on:");
    for (const addon of estimate.addons) {
      lines.push(`- ${cleanMessageText(addon.label)} (${formatRupiah(addon.price)})`);
    }
  }

  lines.push("", `Total Estimasi: ${formatRupiah(estimate.total)}`, "", "Apakah slot tersedia?");
  return lines.join("\n");
}

// encodeURIComponent, lalu tiga karakter yang sah di query string dikembalikan agar hasilnya
// identik dengan contoh FRS 4.1. "&", "=", "#", "+", dan "%" tetap ter-encode sehingga isi pesan
// tidak bisa menambah parameter atau memotong URL.
function encodeWhatsAppText(message: string): string {
  return encodeURIComponent(message).replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%3F/g, "?");
}

export type WhatsAppUrlInput = WhatsAppMessageInput & { vendorPhone: string };

export function buildWhatsAppUrl(input: WhatsAppUrlInput): Result<string, UrlErrorCode> {
  const phone = normalizeWhatsAppNumber(input.vendorPhone);
  if (!phone.ok) return phone;

  const message = buildWhatsAppMessage(input);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return fail("MESSAGE_TOO_LONG", "Pesan terlalu panjang.");
  }

  return ok(`https://wa.me/${phone.data}?text=${encodeWhatsAppText(message)}`);
}

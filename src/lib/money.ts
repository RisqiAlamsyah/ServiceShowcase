// Rupiah selalu bilangan bulat (tanpa float) agar penjumlahan tepat.
// Batas 12 digit mengikuti DECIMAL(12,2) pada SRS dan menjaga hasil tetap aman sebagai integer JS.
export const MAX_RUPIAH = 999_999_999_999;

export function isValidRupiah(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_RUPIAH
  );
}

// Format manual (bukan Intl) supaya hasilnya sama di semua lingkungan dan memakai spasi biasa,
// bukan NBSP, karena dipakai di teks pesan WhatsApp. Contoh: 2500000 -> "Rp 2.500.000".
export function formatRupiah(amount: number): string {
  if (!isValidRupiah(amount)) {
    throw new RangeError("Nominal rupiah tidak valid");
  }
  return `Rp ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

// Membaca harga dari isian teks pengguna. Menerima digit polos ("2500000"), pemisah ribuan titik
// yang benar ("2.500.000"), dan awalan "Rp". Selain itu ditolak, bukan ditebak: "2.5", "1,5",
// "1e6", "-1", dan desimal ambigu antara 2,5 dan 25 ribu. Mengembalikan null bila tidak valid.
export function parseRupiahInput(raw: string): number | null {
  const body = raw.trim().replace(/^rp\.?\s*/i, "");
  let digits: string;
  if (/^\d+$/.test(body)) digits = body;
  else if (/^\d{1,3}(\.\d{3})+$/.test(body)) digits = body.replaceAll(".", "");
  else return null;
  if (digits.length > 12) return null;
  const value = Number(digits);
  return isValidRupiah(value) ? value : null;
}

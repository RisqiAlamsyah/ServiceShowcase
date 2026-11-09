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

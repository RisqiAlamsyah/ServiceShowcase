// Tanggal acara memakai string ISO "YYYY-MM-DD" (tanpa zona waktu) agar tidak bergeser hari.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = { year: number; month: number; day: number };

export function parseIsoDate(iso: string): DateParts | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Hanya tanggal kalender nyata: 2026-02-30 ditolak, 2028-02-29 (kabisat) diterima.
  const probe = new Date(Date.UTC(year, month - 1, day));
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

export function isValidIsoDate(iso: string): boolean {
  return parseIsoDate(iso) !== null;
}

// "2026-12-15" -> "15/12/2026" (format FRS 4.1).
export function formatIdDate(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) throw new RangeError("Tanggal ISO tidak valid");
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  return `${dd}/${mm}/${parts.year}`;
}

// Perbandingan leksikografis aman karena format ISO tetap lebar. Hanya untuk tanggal yang sudah valid.
export function isBeforeIsoDate(a: string, b: string): boolean {
  return a < b;
}

// Tanggal hari ini di Asia/Jakarta (WIB). Pada 20:00 UTC tanggalnya sudah hari berikutnya di WIB.
export function todayInJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Menggabungkan class kondisional tanpa dependensi tambahan.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

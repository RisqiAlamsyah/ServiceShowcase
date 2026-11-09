# LOCAL-20261109-booking-core — Implementasi

**Branch:** feature/booking-core  **Tanggal:** 2026-11-09

## Ringkasan
Inti domain murni (tanpa DB, tanpa UI) untuk MOD-05 dan MOD-06: penghitung estimasi berbasis rupiah bilangan bulat, pembentuk pesan dan URL WhatsApp persis format FRS 4.1, normalisasi nomor vendor, dan skema validasi input pemesan. Tidak ada dependensi baru (hanya `zod` yang sudah ada).

## File yang Berubah
- `src/types/result.ts`: tipe `Result` untuk operasi domain murni (`ok`/`fail`)
- `src/lib/money.ts`: `isValidRupiah`, `formatRupiah` (manual, bukan Intl), `MAX_RUPIAH` (12 digit)
- `src/lib/booking/types.ts`: `BookingPackage`, `BookingAddon`, `Estimate`, `MAX_ADDONS = 20`
- `src/lib/booking/calculator.ts`: `calculateEstimate` (harga dari data server, pemesan hanya memilih ID)
- `src/lib/booking/date.ts`: validasi tanggal kalender ISO, format `dd/mm/yyyy`, `todayInJakarta`
- `src/lib/booking/whatsapp.ts`: `normalizeWhatsAppNumber`, `cleanMessageText`, `buildWhatsAppMessage`, `buildWhatsAppUrl`
- `src/lib/validation/booking.ts`: `createBookingInputSchema(todayIso)` (Zod `.strict()`)
- Tes: `tests/money.test.ts`, `booking-date.test.ts`, `booking-calculator.test.ts`, `booking-whatsapp.test.ts`, `booking-validation.test.ts`

## Keputusan Desain
- **Rupiah bilangan bulat, batas 12 digit.** Tidak ada float; total yang melewati batas ditolak (`TOTAL_TOO_LARGE`), tidak meluap diam-diam.
- **Pemesan hanya memilih ID; harga selalu dari data server.** Add-on yang tidak ada di penawaran paket ditolak, duplikat dihitung sekali, urutan mengikuti penawaran.
- **`allowAddons`** mengimplementasikan batas tier Free (SRS 7.1) sebagai parameter murni; pemanggil di server yang menentukan nilainya dari plan pengguna.
- **URL identik dengan contoh SRS.** `encodeURIComponent` lalu `%3A`, `%2F`, `%3F` dikembalikan (sah di query string) agar cocok karakter per karakter. `& = # + %` tetap ter-encode, jadi isi pesan tidak bisa menambah parameter atau memotong URL.
- **Nama pemesan:** whitespace dilipat (baris baru tidak ditolak, hanya jadi spasi), lalu hanya huruf Unicode, angka, spasi, dan `. , ' ’ -` yang diterima (2 sampai 60 karakter). Tanpa `<>&=#%+`, emoji, karakter kontrol, atau karakter format/bidi. Teks dibersihkan **lagi** saat menyusun pesan (pertahanan berlapis), termasuk nama paket/add-on dari vendor.
- **Nomor WA: Indonesia saja pada V1** (`62` diikuti 8 sampai 13 digit). Nomor internasional ditolak. Lihat open question.
- **Tanggal acara:** `YYYY-MM-DD`, kalender nyata, tidak lampau (WIB), maksimal tahun berjalan + 3. `today` diberikan pemanggil agar fungsi tetap murni.
- Galat tidak memuat data masukan (tidak memantulkan input pengguna).

## Dampak Keamanan
- Injeksi baris/teks ke pesan WhatsApp dan injeksi parameter URL diuji (nama, nama paket, nomor).
- Mass assignment (`total`, `planType`, `isAdmin`) ditolak lewat `.strict()`.
- Batas panjang/jumlah pada semua input (nama 60, add-on 20, pesan 2000, ID 64).
- Tidak ada data sensitif, log, jaringan, atau dependensi baru.

## Verifikasi
| Perintah | Hasil |
|---|---|
| `npm run test` | lulus, **128 tes** (6 berkas), termasuk golden test URL = contoh SRS |
| `npm run typecheck` | lulus |
| `npm run lint` | lulus |
| Uji mutasi manual (12 perusakan kode satu per satu) | 11 terdeteksi tes; 1 selamat = *equivalent mutant* (cek `getUTCDate` redundan karena cek bulan sudah menangkap tanggal meluap) |
| `npm run build`, `npm run test:e2e` | tidak dijalankan: fitur ini tidak mengubah route, config, atau UI |

Skrip uji mutasi ada di scratchpad sesi, bukan bagian repo.

Catatan lingkungan: berkas scaffold (`layout.tsx`, `page.tsx`, `proxy.ts`, `e2e/home.spec.ts`) berakhiran baris CRLF dari checkout Windows sehingga `prettier --check` memberi peringatan; berkas baru di tiket ini LF. Saran tiket terpisah: tambah `.gitattributes` (`* text=auto eol=lf`).

## Open Question
1. **Nomor WhatsApp internasional** (vendor di luar Indonesia) ditolak pada V1. Perlu dilonggarkan?
2. **Batas tahun ke depan (3 tahun)** dan **tanggal hari ini boleh dipilih**: sesuaikan bila bisnis menghendaki lain.
3. **Pesan WA memakai satu bahasa (Indonesia)**; jika nanti butuh multibahasa, template perlu dipisah.
4. UI kalkulator dan halaman publik (tiket berikutnya) harus memakai fungsi ini dengan data dari server; total di klien hanya tampilan.

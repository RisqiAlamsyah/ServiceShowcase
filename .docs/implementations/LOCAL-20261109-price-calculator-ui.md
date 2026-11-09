# LOCAL-20261109-price-calculator-ui — Implementasi

**Branch:** feature/price-calculator-ui  **Tanggal:** 2026-11-09

## Ringkasan
Halaman demo `/demo` dengan kalkulator estimasi interaktif yang memakai inti dari tiket `booking-core` (`calculateEstimate`, `createBookingInputSchema`, `buildWhatsAppUrl`, `buildWhatsAppMessage`) dan data contoh fiktif. Memilih paket dan add-on memperbarui total real-time; form nama dan tanggal divalidasi dengan skema yang sama dengan server; input valid menampilkan **pratinjau pesan WhatsApp** (teks). Mode demo tidak membuka WhatsApp dan tidak memakai nomor nyata. Tier Free/Pro lewat `?tier=`.

## File yang Berubah
- `src/components/booking/price-calculator.tsx`: Client Component (state, validasi, fokus, pratinjau)
- `src/app/demo/page.tsx`: Server Component; `searchParams` divalidasi Zod; `await connection()` agar nonce CSP berlaku; `noindex`
- `src/app/page.tsx`: tombol menuju `/demo`
- `src/lib/booking/sample-data.ts`: paket, add-on, dan vendor contoh (nomor fiktif, tidak pernah dibuka)
- `src/lib/booking/types.ts`: tipe `PublicPackageOffer` (bentuk data yang aman dikirim ke klien)
- `src/lib/utils.ts`: helper `cx` (tanpa dependensi baru)
- `src/app/globals.css`: token `--color-danger`
- `src/lib/validation/booking.ts`: pesan tanggal kosong menjadi "Pilih tanggal acara." (sebelumnya "Tanggal tidak valid.")
- Tes: `e2e/demo.spec.ts` (baru), `tests/booking-validation.test.ts` (+1 tes)

## Keputusan Desain
- **Mode demo hanya pratinjau.** Tombol yang sungguh membuka `wa.me` ikut halaman publik `/{slug}` bersama data nyata, supaya tidak ada nomor fiktif yang bisa dihubungi dan jalur "live" tidak dikirim tanpa tes.
- **Tier lewat query `?tier=`** hanya untuk demo. `z.enum(["free","pro"]).catch("pro")`: nilai lain (markup, array, kosong, huruf besar) jatuh ke Pro, tidak pernah melempar error. Pada halaman nyata, tier berasal dari data vendor di server, bukan dari URL.
- **Pertahanan berlapis untuk tier Free:** checkbox `disabled`, `toggleAddon` menolak, dan `calculateEstimate` menolak add-on bila `allowAddons=false`. Diuji termasuk skenario DevTools (atribut `disabled` dilepas paksa).
- **Pratinjau dihapus saat pilihan berubah**, agar tidak menampilkan data basi.
- **Pesan dirender sebagai teks** (`<pre>{preview}</pre>`), tanpa HTML mentah. `todayIso` datang dari server (WIB) supaya server dan klien sepakat soal "hari ini" dan tidak ada ketidakcocokan hidrasi.
- **Aksesibilitas:** `fieldset`/`legend`, label terhubung ke input, `aria-invalid` + `aria-describedby`, total pada `aria-live="polite"`, fokus ke kolom bermasalah pertama atau ke judul pratinjau setelah sukses, target sentuh ≥ 44 px.
- **Kontras:** terracotta hanya untuk bingkai/ornamen/eyebrow besar; teks galat memakai `--color-danger` (`#b42318`).
- **`FormEvent` diganti `SyntheticEvent`** (tipe React terbaru menandai `FormEvent` deprecated).
- Tidak ada dependensi baru.

## Dampak Keamanan
- Input pemesan divalidasi dengan skema yang sama dengan server (`.strict()`, batas panjang); markup ditolak dan tidak pernah dirender sebagai HTML (diuji).
- `searchParams` divalidasi Zod; payload berbahaya tidak merusak halaman (diuji 6 variasi).
- Hanya data publik contoh yang dikirim ke Client Component.
- CSP tidak dilonggarkan; diuji tanpa pelanggaran di `/demo` (termasuk saat submit). Mode demo diuji tidak melakukan request/popup ke WhatsApp.
- Catatan: validasi di klien hanya UX; saat halaman nyata memakai Server Action, validasi server tetap wajib (RULES §5).

## Verifikasi
| Perintah | Hasil |
|---|---|
| `npm run typecheck` | lulus |
| `npm run lint` | lulus (0 masalah) |
| `npm run test` | lulus, **147 tes** |
| `npm run build` | lulus; `/` dan `/demo` dinamis, `Proxy` terdeteksi |
| `npm run test:e2e` | lulus, **48 tes** (desktop + mobile Pixel 7), termasuk `home.spec.ts` yang sudah ada |
| `npm audit --omit=dev` | 0 kerentanan |
| Uji mutasi UI (6 perusakan kode, E2E desktop) | 5 terdeteksi dari awal; 1 lolos (guard `toggleAddon` untuk tier Free, tak terjangkau dari UI normal). Ditutup dengan tes skenario DevTools, lalu terdeteksi |
| Tinjauan visual (screenshot Playwright 360 px dan 1280 px) | dibaca langsung; layout rapi. Ditemukan deskripsi paket menyempit di mobile dan pesan tanggal kosong kurang jelas, keduanya diperbaiki dan diperiksa ulang |

Skrip mutasi dan screenshot ada di scratchpad sesi, bukan bagian repo.

Belum diuji: Safari/Firefox (hanya Chromium: Desktop Chrome dan Pixel 7), pembaca layar sungguhan, dan tampilan date picker native di OS lain.

## Open Question
1. **Tombol yang membuka WhatsApp sungguhan** akan dikerjakan bersama halaman publik `/{slug}` (fitur 7) dengan data dari DB. Perlu keputusan: `window.open` atau tautan `<a target="_blank">` (saya cenderung tautan agar tidak terblokir pop-up).
2. **Batas Free (2 paket, 3 foto)** belum ditegakkan di demo; itu urusan service + DB.
3. **Format tanggal** mengikuti locale browser pada input native (mis. `dd/mm/yyyy` atau `mm/dd/yyyy`); nilai yang dikirim tetap ISO.
4. Halaman `/demo` dibuat `noindex`. Ubah bila ingin dijadikan halaman pemasaran yang terindeks.

# LOCAL-20261109-price-calculator-ui — UI kalkulator estimasi publik (demo)

> **Area:** UI / halaman publik
> **Tanggal dibuat:** 2026-11-09
> **Tanggal mulai:** 2026-11-09
> **Tanggal selesai:** 2026-11-09
> **Status:** Done
> **Implementasi:** [LOCAL-20261109-price-calculator-ui](../implementations/LOCAL-20261109-price-calculator-ui.md)
> **Branch:** feature/price-calculator-ui
> **Dampak keamanan:** Input pemesan (nama, tanggal), parameter URL, CSP

## Deskripsi
Fitur 2 dari SRS (`.docs/SRS.md` §4): antarmuka kalkulator interaktif yang memakai inti dari tiket `booking-core`, dengan **data contoh** (belum ada DB). Dipasang di halaman demo `/demo`.

- Pilih satu paket (radio) dan add-on (checkbox); total diperbarui **real-time** (`aria-live`).
- Tier lewat query `?tier=free|pro` (divalidasi Zod, nilai lain jatuh ke `pro`). Tier **free**: add-on terkunci dan ditandai "Tersedia di paket Pro" (SRS 7.1).
- Form nama dan tanggal acara divalidasi dengan `createBookingInputSchema`; galat tampil per kolom, fokus pindah ke kolom bermasalah pertama.
- Submit yang valid menampilkan **pratinjau pesan WhatsApp** (teks saja). Mode demo **tidak membuka WhatsApp** dan tidak memakai nomor nyata.
- Mobile-first (360 px), tema SRS §8, aksesibel (label, fieldset/legend, fokus terlihat, target sentuh ≥ 44 px).

**Tidak termasuk:** tombol yang benar-benar membuka `wa.me` (ikut halaman publik `/{slug}` bersama data nyata), DB, Auth, upload, galeri.

## Scope Teknis
| Lapisan | File |
|---|---|
| Data contoh | `src/lib/booking/sample-data.ts`, `src/lib/utils.ts` (`cx`), tipe `PublicPackageOffer` di `types.ts`, token `--color-danger` |
| Komponen (client) | `src/components/booking/price-calculator.tsx` |
| Halaman (server) | `src/app/demo/page.tsx`, tautan dari `src/app/page.tsx` |
| Tes | `e2e/demo.spec.ts`; pesan tanggal kosong di `src/lib/validation/booking.ts` + tesnya |

## Acceptance Criteria
- [x] Memilih paket dan add-on mengubah total persis sesuai `calculateEstimate`; ganti paket mereset add-on
- [x] `?tier=free` mengunci add-on; `?tier=` berisi nilai aneh/markup tidak merusak halaman dan jatuh ke default
- [x] Nama kosong/berbahaya, tanggal lampau, dan tanggal tidak valid menghasilkan pesan galat per kolom; pratinjau tidak muncul
- [x] Input valid menampilkan pratinjau pesan sesuai format FRS 4.1, dirender sebagai teks (tanpa HTML mentah)
- [x] Tidak ada pelanggaran CSP; tidak ada `dangerouslySetInnerHTML`; tidak ada panggilan jaringan ke WhatsApp
- [x] Layout nyaman di 360 px (tanpa scroll horizontal) dan 1280 px
- [x] Fokus pindah ke galat pertama / ke pratinjau setelah sukses

## Verifikasi
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e` lulus
- [x] E2E: jalur berhasil, jalur gagal (validasi), tier free, parameter tier berbahaya, CSP bersih; desktop + mobile

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Input divalidasi (skema yang sama dengan server), `searchParams` divalidasi Zod
- [x] Tidak ada data sensitif ke klien (hanya data publik contoh)
- [x] Tidak ada dependensi baru
- [x] CSP tidak dilonggarkan

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan

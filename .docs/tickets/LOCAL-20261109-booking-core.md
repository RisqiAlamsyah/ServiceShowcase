# LOCAL-20261109-booking-core — Inti kalkulator estimasi (MOD-05) dan pembentuk pesan WhatsApp (MOD-06)

> **Area:** Logika domain murni (tanpa DB, tanpa UI)
> **Tanggal dibuat:** 2026-11-09
> **Tanggal mulai:** 2026-11-09
> **Tanggal selesai:** 2026-11-09
> **Tanggal mulai perbaikan:** 2026-11-09 (nomor WhatsApp internasional diizinkan, keputusan user)
> **Status:** Done
> **Implementasi:** [LOCAL-20261109-booking-core](../implementations/LOCAL-20261109-booking-core.md)
> **Branch:** feature/booking-core
> **Dampak keamanan:** Input (nama klien, tanggal, nomor WA), injeksi teks/URL

## Deskripsi
Fitur 1 dari SRS (urutan di `.docs/SRS.md` §4): fungsi murni yang dipakai halaman publik nanti, diuji berat sebelum disambung ke database dan UI.

- **MOD-05 (inti):** hitung estimasi dari satu paket + add-on terpilih, dalam rupiah bilangan bulat (tanpa float), dengan format `Rp 2.500.000`. Aturan tier: kalkulator Free tidak mengizinkan add-on (`allowAddons`).
- **MOD-06:** susun pesan WhatsApp persis format FRS 4.1 dan bentuk URL `https://wa.me/<nomor>?text=...`. Normalisasi nomor vendor (08xx / +62 / 62 menjadi `62...`). Validasi input pemesan: nama (aman dari injeksi baris/karakter kontrol), tanggal acara (kalender valid, bukan lampau).

**Tidak termasuk:** UI kalkulator dan halaman publik (tiket berikutnya), Prisma/DB, Auth, upload. Harga yang dipakai nanti selalu berasal dari server; fungsi ini hanya menerima data yang sudah dimuat.

## Scope Teknis
| Lapisan | File |
|---|---|
| Util | `src/lib/money.ts`, `src/types/result.ts` |
| Domain | `src/lib/booking/types.ts`, `calculator.ts`, `date.ts`, `whatsapp.ts` |
| Validasi | `src/lib/validation/booking.ts` |
| Tes | `tests/money.test.ts`, `tests/booking-date.test.ts`, `tests/booking-calculator.test.ts`, `tests/booking-whatsapp.test.ts`, `tests/booking-validation.test.ts` |

## Acceptance Criteria
- [x] Contoh FRS 4.1 (Siti Rahma, paket 2.500.000 + add-on 350.000) menghasilkan URL **identik karakter per karakter** dengan yang ada di SRS
- [x] Total dihitung dengan bilangan bulat; harga tidak valid (negatif, pecahan, melebihi batas, NaN) ditolak
- [x] Add-on tidak dikenal, duplikat, atau terpilih saat `allowAddons=false` ditangani dengan kode galat yang jelas; urutan add-on di pesan stabil
- [x] Nama pemesan tidak bisa menyisipkan baris baru, karakter kontrol, markup, atau parameter URL tambahan
- [x] Nomor vendor dinormalisasi ke format internasional tanpa `+` (Indonesia `08xx`/`+62`/`62` menjadi `62...`; negara lain wajib `+kode` atau `00kode`); nomor tidak valid ditolak
- [x] Tanggal acara: format `YYYY-MM-DD`, tanggal kalender nyata, tidak lampau
- [x] URL hasil hanya memiliki satu parameter `text` dan host `wa.me`

## Verifikasi
- [x] `npm run lint`, `npm run typecheck`, `npm run test` lulus
- [x] Setiap fungsi punya tes: jalur berhasil, input tidak valid, dan kasus injeksi/batas

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Semua input pemesan divalidasi (Zod `.strict()`, batas panjang)
- [x] Tidak ada data sensitif/log; tidak ada dependensi baru
- [x] Injeksi teks dan parameter URL diuji

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan

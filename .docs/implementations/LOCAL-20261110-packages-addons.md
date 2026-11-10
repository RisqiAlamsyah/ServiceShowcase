# LOCAL-20261110-packages-addons — Implementasi

**Branch:** feature/packages-addons  **Tanggal:** 2026-11-10  **PR:** (diisi setelah dibuka)

> Branch ini dibangun di atas `feature/profile-slug` (PR #12) karena memakai komponen form bersama, `FormState`, dan halaman dashboard dari sana. PR dibuka setelah #12 ter-merge.

## Ringkasan
Vendor mengelola paket jasa dan add-on di `/dashboard/paket` dan `/dashboard/paket/[id]`. Batas tier ditegakkan di server: Free maksimal 2 paket dan tanpa add-on; Pro dibatasi hanya oleh pengaman anti-penyalahgunaan (50 paket, 20 add-on per paket). Sesuai keputusan user, paket di luar batas setelah turun ke Free **disembunyikan, tidak dihapus**.

## File yang Berubah
- `src/lib/plans.ts`: `PLAN_LIMITS`, `publiclyVisiblePackageIds`, `addonsPubliclyVisible`, `sortPackages` (murni; dipakai dashboard sekarang dan halaman publik tiket 7).
- `src/lib/money.ts`: `parseRupiahInput` (digit polos, pemisah ribuan titik yang benar, awalan "Rp"; selain itu ditolak).
- `src/lib/validation/package.ts`: skema `.strict()` (nama, deskripsi, harga, id `cuid`).
- `src/server/package/service.ts`: daftar/baca/buat/ubah/hapus paket dan add-on; kepemilikan di query; batas tier dalam transaksi.
- `src/actions/package.ts`: enam action dengan pembungkus bersama (login → rate limit → validasi → service).
- `src/server/auth/rate-limit.ts`: `packageWrite` (120/jam per pengguna).
- UI: `src/app/(app)/dashboard/paket/page.tsx`, `.../[id]/page.tsx`, kartu di `dashboard/page.tsx`, `src/components/package/{package-form,addon-form}.tsx`, `src/components/ui/{confirm-delete-form,use-focus-first-error}`.
- Tes: `tests/{plans,money-input,package-validation,package-service,package-actions}.test.ts`, `e2e/package.spec.ts`, `e2e/package-flow.spec.ts` (butuh DB), `e2e/helpers/session.ts` (helper bersama; `profile-flow` memakainya).

## Keputusan Desain
- **Keterlihatan dihitung saat dibaca, tanpa kolom baru dan tanpa migrasi.** Paket terlihat = N pertama menurut `position`, `createdAt`, `id`; add-on terlihat hanya bila Pro. Naik ke Pro otomatis menampilkan semuanya lagi.
- **Batas menghitung semua paket** (termasuk yang disembunyikan): vendor di atas batas tetap bisa mengubah/menghapus, tidak bisa menambah. Add-on lama dari masa Pro tetap tersimpan dan bisa diubah/dihapus, tetapi tidak tampil publik.
- **Anti permintaan bersamaan:** `pg_advisory_xact_lock(hashtext(userId))` di awal transaksi, lalu baca `plan` dari DB, hitung, dan tulis. Teruji terhadap PostgreSQL sungguhan (alur E2E membuat paket lewat jalur ini).
- **Tier tidak pernah dari sesi/input:** `plan` dibaca ulang dalam transaksi. `ownerId` selalu dari sesi; `Addon.ownerId` disalin dari paket yang sudah diverifikasi milik pengguna.
- **Milik orang lain = 404/NOT_FOUND**, bukan 403: id tidak valid atau bukan milik pengguna diperlakukan sama.
- **Hapus dua langkah** (tombol buka konfirmasi → tombol submit di dalam form). Hapus paket menghapus add-on lewat `onDelete: Cascade`.
- **Urutan = urutan pembuatan** (`position` dinaikkan otomatis); pengurutan ulang tidak termasuk tiket ini.
- **Parser harga ketat:** "2.5" ditolak (ambigu), bukan ditebak. Batas 12 digit mengikuti `MAX_RUPIAH`.
- **E2E mengubah `plan` lewat helper `setPlan`** (SQL langsung ke DB dev, hanya untuk email `@example.test`) karena belum ada jalur UI/billing untuk upgrade (open question SRS).
- **Tipe `FormState`** disamakan untuk create/update agar satu form bisa memilih antara dua action.

## Dampak Keamanan
Otorisasi (kepemilikan paket/add-on, IDOR), input (Zod `.strict()`, `cuid`, batas panjang), gating tier (server, bukan UI), rate limit tulis, tanpa data pribadi baru. Checklist §13: tanpa rahasia di diff; semua action memanggil `requireUser()` lebih dulu; tes berhasil/tidak valid/akses ditolak/IDOR untuk setiap action dan fungsi service; 404 untuk milik orang lain; pesan error generik dan log hanya nama error; tanpa `dangerouslySetInnerHTML`. Tanpa dependensi baru.

## Verifikasi
- `npm run lint` dan `npm run typecheck` → lulus
- `npm run test` → 382/382 lulus (PowerShell)
- `npm run build` → lulus; rute `/dashboard/paket` dan `/dashboard/paket/[id]` terdaftar
- `npm run test:e2e` tanpa DB (desktop + mobile) → 76 lulus, 6 dilewati (alur DB)
- `E2E_WITH_DB=1 npx playwright test auth-flow profile-flow package-flow` terhadap Neon dev → 6/6 lulus (desktop + mobile). `package-flow` mencakup: validasi harga, batas Free, add-on ditolak di Free, naik ke Pro, tambah/ubah add-on, paket ke-3, turun ke Free (paket ke-3 "Disembunyikan", add-on tetap ada), hapus dua langkah termasuk Batal, dan pengguna B mendapat 404 pada paket milik A.
- `npm audit --omit=dev --audit-level=high` → 0 kerentanan
- Akun/paket/add-on uji `e2e-*@example.test` tertinggal di database dev (disengaja)

## Open Question
1. Cara vendor menjadi Pro (billing atau admin manual) masih terbuka (SRS §5); sementara `plan` hanya diubah langsung di DB.
2. Pengurutan ulang paket/add-on (seret atau tombol naik/turun) belum ada; kandidat tiket kecil.
3. Batas pengaman Pro (50 paket, 20 add-on per paket) adalah angka pilihan; ubah di `src/lib/plans.ts` bila produk menghendaki lain.

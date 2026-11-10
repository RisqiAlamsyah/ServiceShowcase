# LOCAL-20261110-profile-slug — Implementasi

**Branch:** feature/profile-slug  **Tanggal:** 2026-11-10  **PR:** (diisi setelah dibuka)

## Ringkasan
Vendor yang sudah masuk dapat membuat dan mengubah profil bisnis (nama bisnis, nomor WhatsApp, bio) dan memilih slug untuk alamat publik `/{slug}`. Halaman publik `/{slug}` sendiri belum ada (tiket 7). Slug boleh diganti (keputusan user, opsi B): link lama berhenti berfungsi, penggantian wajib dikonfirmasi dan dibatasi 3 kali per hari.

## File yang Berubah
- `src/lib/validation/profile.ts`: skema `.strict()`; slug `^[a-z0-9-]{3,30}$` tanpa tanda hubung di tepi/ganda dan bukan kata terlarang; WhatsApp memakai ulang `normalizeWhatsAppNumber` (hasil E.164 tanpa plus); bio opsional.
- `src/lib/profile/reserved-slugs.ts`: daftar slug terlarang.
- `src/server/profile/service.ts`: `getProfileForUser` (kepemilikan di query), `saveProfile` (upsert per `ownerId`; bentrok unik ditangani).
- `src/actions/profile.ts`: `saveProfileAction` (login → rate limit → validasi → konfirmasi/batas ganti slug → simpan → revalidasi).
- `src/server/auth/rate-limit.ts`: `profileWrite` (30/jam) dan `slugChange` (3/hari).
- `src/app/(app)/dashboard/profil/page.tsx`, `src/components/profile/profile-form.tsx`, kartu status di `src/app/(app)/dashboard/page.tsx`.
- `src/components/ui/text-field.tsx` (dipindah dari `components/auth`, ditambah `prefix`, `type=tel`, `onValueChange`) dan `text-area-field.tsx`.
- `src/types/action.ts`: `FormState`/`FormValues` (isian dikembalikan ke form).
- Tes: `tests/profile-{validation,reserved-slugs,service,actions}.test.ts`, `e2e/profile.spec.ts`, `e2e/profile-flow.spec.ts` (butuh DB, dilewati di CI).

## Keputusan Desain
- **Tanpa migrasi:** model `Profile` dan unik `slug`/`owner_id` sudah ada di migrasi awal.
- **Keunikan slug di DB, bukan di kode.** Tabrakan (termasuk balapan dua pengguna) ditangkap dari `P2002`; karena meta target tidak bisa diandalkan dengan driver adapter, penyebabnya ditentukan dengan membaca pemegang slug: milik orang lain = `SLUG_TAKEN`, selain itu dicoba ulang sekali (kiriman ganda pengguna yang sama).
- **Daftar slug terlarang dijaga tes** yang membaca folder `src/app` (termasuk isi route group): menambah rute baru tanpa mendaftarkannya membuat tes gagal. Rute `/[slug]` tiket 7 tidak akan bisa ditabrak.
- **Slug lama dilepas** (opsi B) dan bisa diambil pengguna lain; ini sudah diperingatkan di kotak konfirmasi. Pengalihan slug lama (opsi C) dicatat sebagai tiket lanjutan.
- **Batas ganti slug dipakai sebelum simpan,** sehingga percobaan memakai slug yang sudah dipegang orang lain juga menghabiskan kuota (sekaligus menyulitkan penebakan slug). Profil pertama tidak terkena batas/konfirmasi.
- **Pesan "slug sudah dipakai" membocorkan keberadaan slug** itu; ini sengaja karena slug adalah alamat publik.
- **Isian dikembalikan dari action** (`values`) dan form di-`key` per hasil, karena React 19 me-reset form uncontrolled setelah action selesai (masalah yang sama pernah mengosongkan form login; login belum diubah).
- `ownerId` selalu dari sesi; field `ownerId`/`userId` di form diabaikan (teruji).

## Dampak Keamanan
Menyentuh otorisasi (kepemilikan profil), input pengguna, data pribadi (nomor WhatsApp, bio), rate limit tulis. Checklist §13: tanpa rahasia di diff; input divalidasi Zod `.strict()` dengan batas panjang; action memanggil `requireUser()` lebih dulu dan kepemilikan ikut di query; tes berhasil/tidak valid/akses ditolak/IDOR; pesan error generik, log hanya nama error; endpoint tulis berlimit laju; tidak ada `dangerouslySetInnerHTML`; React meng-escape bio dan nama saat dirender.
Belum dipenuhi/ditunda: validasi tautan di bio (tidak ada tautan), konfirmasi ulang sandi (tidak disyaratkan untuk profil).

## Verifikasi
- `npm run lint` → lulus; `npm run typecheck` → lulus
- `npm run test` → 277/277 lulus (PowerShell)
- `npm run build` → lulus; rute `/dashboard/profil` terdaftar
- `npm run test:e2e` tanpa DB (desktop + mobile) → 72 lulus, 4 dilewati (alur DB)
- `E2E_WITH_DB=1 npx playwright test auth-flow profile-flow` terhadap Neon dev → 4/4 lulus (desktop + mobile): buat profil, galat per kolom + isian bertahan + fokus, nomor dinormalkan, ganti slug butuh konfirmasi, bentrok slug antar dua pengguna, slug lama dilepas
- `npm audit --omit=dev --audit-level=high` → 0 kerentanan
- Akun/profil uji `e2e-*@example.test` tertinggal di database dev (disengaja)

## Open Question
1. Pengalihan slug lama (opsi C) dan cek ketersediaan slug saat mengetik: tiket lanjutan bila diinginkan.
2. Slug "dilepas" dapat diambil siapa pun; pertimbangkan masa tahan (mis. 30 hari) sebelum slug lama dipakai ulang bila ada keluhan penyalahgunaan.
3. Form login masih mengosongkan email setelah gagal (React reset); pola `values` di tiket ini dapat dipakai.

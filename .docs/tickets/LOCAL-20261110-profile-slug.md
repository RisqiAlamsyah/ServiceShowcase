# LOCAL-20261110-profile-slug — Profil vendor dan slug

> **Area:** UI, Server Action/API
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Status:** Done
> **Implementasi:** [LOCAL-20261110-profile-slug](../implementations/LOCAL-20261110-profile-slug.md)
> **Branch:** feature/profile-slug
> **Dampak keamanan:** Otorisasi (kepemilikan data), Input, Data pribadi (nomor WhatsApp), Rate limit

## Deskripsi
MOD-02 (SRS §2, §3): vendor yang sudah masuk mengisi profil bisnis dan memilih slug untuk alamat publik `/{slug}`.

Keputusan user (10 Nov 2026):
- Nomor WhatsApp disimpan sebagai **E.164 tanpa tanda plus**, memakai ulang `normalizeWhatsAppNumber` (menerima `08xx`, `+62`, dan nomor internasional dengan `+`/`00`).
- Slug **boleh diganti setelah dibuat (opsi B)**: link lama berhenti berfungsi. Perubahan wajib dikonfirmasi lewat kotak centang, dibatasi **3 kali per hari**, dan slug lama dilepas.

Aturan slug (SRS §3): `^[a-z0-9-]{3,30}$`, tidak diawali/diakhiri tanda hubung, tidak memuat `--`, dan bukan kata terlarang. Daftar terlarang harus mencakup semua rute aplikasi (dijaga oleh tes yang membaca folder `src/app`). Keunikan ditegakkan di DB (`profiles.slug` unik); tabrakan menghasilkan pesan `CONFLICT`.

Halaman: `/dashboard/profil` (form), kartu status di `/dashboard`.

**Tidak termasuk:** halaman publik `/{slug}` (tiket 7), pengalihan slug lama (opsi C, tiket lanjutan), cek ketersediaan slug saat mengetik (butuh endpoint baru), foto profil, migrasi DB (model `Profile` sudah ada).

## Scope Teknis
| Lapisan | File |
|---|---|
| Halaman/Komponen | `src/app/(app)/dashboard/profil/page.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/components/profile/profile-form.tsx` |
| Action | `src/actions/profile.ts` |
| Service | `src/server/profile/service.ts` |
| Validasi | `src/lib/validation/profile.ts`, `src/lib/profile/reserved-slugs.ts` |
| Rate limit | `src/server/auth/rate-limit.ts` (`RATE_RULES`) |
| Tes | `tests/profile-*.test.ts`, `e2e/profile.spec.ts`, `e2e/profile-flow.spec.ts` (butuh DB, dilewati di CI) |

## Acceptance Criteria
- [x] Pengguna yang login dapat membuat dan mengubah profil sendiri; `ownerId` selalu dari sesi, tidak pernah dari input
- [x] Pengguna A tidak bisa membaca atau mengubah profil pengguna B (IDOR)
- [x] Slug divalidasi regex + daftar terlarang; semua rute aplikasi tercakup (tes membaca `src/app`)
- [x] Slug yang sudah dipakai ditolak dengan pesan jelas; tabrakan balapan ditangani via constraint DB
- [x] Mengganti slug butuh konfirmasi, dibatasi 3 kali per hari; slug lama dilepas
- [x] Nomor WhatsApp dinormalkan ke E.164 tanpa plus; nomor tidak valid ditolak per kolom
- [x] `/dashboard/profil` tanpa sesi diarahkan ke `/masuk`
- [x] Form mempertahankan isian saat gagal dan memindahkan fokus ke galat pertama

## Verifikasi
- [x] `npm run lint` dan `npm run typecheck` lulus
- [x] `npm run test` lulus: berhasil, input tidak valid, akses ditolak, IDOR
- [x] `npm run test:e2e` lulus (tanpa DB); alur penuh `E2E_WITH_DB=1` lulus terhadap Neon dev
- [x] `npm run build` lulus
- [x] `npm audit --omit=dev` tanpa High/Critical

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff
- [x] Input divalidasi Zod di server (`.strict()`, batas panjang)
- [x] Action: otentikasi + otorisasi + kepemilikan di query
- [x] Tes: berhasil, tidak valid, akses ditolak, IDOR
- [x] Endpoint tulis berlimit laju
- [x] Tidak ada data sensitif ke log; pesan error generik

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan (diff diperiksa)

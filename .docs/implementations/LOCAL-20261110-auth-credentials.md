# LOCAL-20261110-auth-credentials — Implementasi

**Branch:** feature/auth-credentials  **Tanggal:** 2026-11-10  **PR:** (diisi setelah dibuka)

## Ringkasan
Daftar, login, dan logout dengan email + sandi memakai next-auth 5.0.0-beta.32 (dikunci), sandi Argon2id, sesi JWT 1 jam, dan rate limit berbasis tabel PostgreSQL. Halaman `/daftar`, `/masuk`, dan `/dashboard` (terproteksi, placeholder). Verifikasi email, reset sandi, dan Google SSO tidak termasuk (tiket terpisah).

## File yang Berubah
- `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`: konfigurasi Auth.js (Credentials, JWT, callback minimal).
- `src/server/auth/{guards,password,rate-limit,credentials}.ts`, `src/server/user/service.ts`: `requireUser` (role/plan dari DB), Argon2id, rate limit atomik, logika `authorize` yang teruji (`authorizeCredentials`), akses data user.
- `src/actions/auth.ts`: `registerAction`, `loginAction`, `logoutAction`.
- `src/lib/validation/auth.ts`, `src/lib/auth/{redirect,common-passwords}.ts`: skema Zod `.strict()`, pencegah open redirect, daftar sandi umum.
- `src/components/auth/*`, `src/app/{masuk,daftar}/page.tsx`, `src/app/(app)/{layout,dashboard/page}.tsx`: UI dan pagar halaman. Tautan Masuk/Daftar di beranda.
- `src/proxy.ts`: pagar kasar `/dashboard` (cek keberadaan cookie sesi saja).
- `prisma/schema.prisma` + `prisma/migrations/20261110120000_add_rate_limit_buckets/`: model `RateLimitBucket`.
- `src/lib/env.schema.ts`: `AUTH_SECRET` (≥ 32 karakter) wajib. `src/types/action.ts`: `ActionResult`.
- Tes: `tests/auth-{validation,password,rate-limit,actions,guards}.test.ts`, `e2e/auth.spec.ts`, `e2e/auth-flow.spec.ts` (butuh DB; dilewati di CI), `tests/stubs/server-only.ts` + alias di `vitest.config.mts`, `tests/env.test.ts` diperbarui.
- `.github/workflows/ci.yml`: nilai env palsu (`DATABASE_URL`, `AUTH_SECRET`) agar build/e2e lulus tanpa rahasia. `playwright.config.ts`: `AUTH_TRUST_HOST` untuk server uji.
- `package.json`/lockfile: `next-auth@5.0.0-beta.32`, `@node-rs/argon2@2.2.2` (dikunci).

## Keputusan Desain
- **Token hanya memuat ID.** `role`/`plan` dibaca ulang dari DB di `requireUser()`; akun yang dihapus otomatis kehilangan akses walau token belum kedaluwarsa.
- **Anti-enumerasi daftar:** tanpa verifikasi email tidak mungkin menjawab "benar-benar sama" sekaligus login otomatis, jadi pendaftaran tidak langsung login. Email baru maupun sudah terdaftar sama-sama menghitung hash lalu redirect ke `/masuk?daftar=1` dengan pesan netral. Konsekuensi UX: pengguna yang lupa sudah punya akun tidak diberi tahu; teratasi saat reset sandi/verifikasi email ada.
- **Login:** semua kegagalan (format, rate limit, email tak ada, sandi salah) mengembalikan `null` dari `authorize` dan satu pesan generik. Hash tiruan menyamakan waktu saat email tidak ada.
- **Rate limit di `authorize`**, bukan hanya di action, supaya endpoint `/api/auth/callback/credentials` juga terlindungi. Batas: login 5/15 menit per email dan 20/15 menit per IP; daftar 5/jam per IP. Kunci di-hash SHA-256. Gagal tertutup bila DB bermasalah.
- **IP klien** dari `x-real-ip`/`x-forwarded-for` (diisi Vercel). Di luar Vercel header ini bisa dipalsukan; batas per-email tetap berlaku.
- **Pembatas di PostgreSQL** menambah satu query per percobaan login/daftar; cukup untuk V1, bisa diganti Upstash nanti tanpa mengubah pemanggil (`consume`).
- **Tanpa Prisma Adapter** (tidak perlu untuk Credentials + JWT); model `Account`/`Session` ditambah saat Google SSO.
- **`next-auth` masih berlabel beta** (5.0.0-beta.32): dikunci tepat; perlu dipantau untuk pembaruan keamanan.
- **Sandi:** min 12, maks 128, tolak sandi umum (daftar kecil bawaan), monoton, atau sama dengan email. Cek kebocoran HIBP belum ada.
- **Fixture sandi di tes** memakai konstanta dengan komentar `sec-ok` (sandi fiktif; hook menolak literal `password: "..."`).
- **Bug nyata ditemukan lewat uji ke DB (diperbaiki):** Auth.js menambahkan field ekstra (mis. `callbackUrl`, `csrfToken`) ke objek kredensial, sehingga `loginSchema.strict()` menolak SEMUA login, termasuk sandi benar. Tes unit dengan mock tidak menangkapnya. Perbaikan: `authorizeCredentials` hanya mengambil `email` dan `password`; ada tes khusus. Terkonfirmasi: kode lama gagal di e2e DB, kode baru lulus.
- **Bug tes lain yang ditemukan:** (a) `getByRole("alert")` cocok juga dengan route announcer Next; (b) pesan galat lama masih tampil saat percobaan berikutnya dikirim, sehingga isian terhapus oleh reset form React 19 di tengah pengisian; e2e kini memuat ulang `/masuk` sebelum tiap percobaan; (c) tes memakai IP acak (`x-real-ip`) agar tidak kena pembatas pendaftaran antar-run (pembatas sendiri terbukti bekerja: pendaftaran ke-6 dalam sejam ditolak).
- **Catatan UX (belum diubah):** React me-reset form setelah login gagal sehingga email yang diketik ikut terhapus. Dapat diperbaiki dengan mengembalikan nilai non-rahasia (email) dari action; kandidat tiket kecil.
- **Bug tes yang ditemukan:** `beforeEach(() => mock.mockReset())` mengembalikan fungsi mock yang dianggap teardown oleh Vitest; diperbaiki dengan blok `{}`.

## Dampak Keamanan
Menyentuh: otentikasi, sesi, hash sandi, input pengguna, data pribadi (email, nama), rate limit, dependensi.
Checklist §13: tanpa rahasia di diff (nilai CI palsu); input divalidasi Zod `.strict()`; `role`/`plan` tak bisa diisi dari input (diuji); tes berhasil/tidak valid/akses ditolak; pesan generik, tanpa membocorkan keberadaan akun; endpoint rawan abuse berlimit laju; dependensi disetujui, dikunci, `npm audit` bersih; CSP/header tidak dilonggarkan. Cookie sesi memakai default Auth.js (`httpOnly`, `sameSite=lax`, `secure` di https; awalan `__Secure-` di production); `allowDangerousEmailAccountLinking` tidak dipakai.
Belum dipenuhi: IDOR (belum ada resource milik pengguna), cek sandi bocor, `Origin` check manual (hanya Server Action dan endpoint Auth.js yang punya perlindungan bawaan).

## Verifikasi
- `npm run lint` → lulus; `npm run typecheck` → lulus
- `npm run test` → 208/208 lulus (PowerShell)
- `npm run build` → lulus dengan env palsu (`DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`); semua rute terdaftar
- `npm run test:e2e` (desktop + mobile, tanpa DB) → 68 lulus, 2 dilewati (`auth-flow`, butuh DB)
- `npm audit --omit=dev --audit-level=high` → 0 kerentanan
- Migrasi `20261110120000_add_rate_limit_buckets` diterapkan user ke Neon dev (`npm run db:migrate`).
- `E2E_WITH_DB=1 npx playwright test auth-flow` → desktop + mobile lulus terhadap Neon dev: daftar, sandi salah dan email tak terdaftar (pesan sama), login benar ke `/dashboard`, cookie `httpOnly` + `sameSite=Lax`, sesi bertahan setelah reload, keluar lalu `/dashboard` ditolak. Ini juga memverifikasi SQL rate limit (`INSERT ... ON CONFLICT`) terhadap PostgreSQL sungguhan.
- Akun uji `e2e-*@example.test` tertinggal di database dev (disengaja; hanya dev).
- Peringatan dari `pg`: `sslmode=require` akan berubah semantik di pg v9. Disarankan menulis `sslmode=verify-full` di `DATABASE_URL`/`DIRECT_URL` (pengaturan user di `.env.local`/Vercel).

## Open Question
1. Tambahkan baris `AUTH_SECRET=` (nilai palsu) ke `.env.example` (oleh user; Claude tidak boleh membaca/menulis berkas itu).
2. Vercel butuh `AUTH_SECRET` dan `DATABASE_URL` (Preview + Production, nilai **berbeda** per lingkungan) sebelum deploy dari branch ini berhasil, karena build memvalidasi env. Database production (branch `production` Neon) belum punya tabel; migrasi ke sana dijalankan user (`prisma migrate deploy`) sebelum rilis ke `main`.
3. Tiket berikutnya yang bergantung pada ini: verifikasi email + reset sandi (butuh layanan email), Google SSO, cek sandi bocor.

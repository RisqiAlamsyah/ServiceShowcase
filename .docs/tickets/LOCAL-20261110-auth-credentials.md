# LOCAL-20261110-auth-credentials — Auth: daftar, login, dan logout (email + sandi)

> **Area:** Auth
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Status:** Done
> **Implementasi:** [LOCAL-20261110-auth-credentials](../implementations/LOCAL-20261110-auth-credentials.md)
> **Branch:** feature/auth-credentials
> **Dampak keamanan:** Auth, Otorisasi, Input, Data pribadi, Dependensi, Rate limit

## Deskripsi
MOD-01 bagian pertama: vendor mendaftar dan masuk dengan email + sandi. Keputusan user (10 Nov 2026): **next-auth 5.0.0-beta.32** (versi dikunci), cakupan **daftar + login + logout saja**, **rate limit di tabel PostgreSQL**.

- Sandi di-hash **Argon2id** (`@node-rs/argon2`), minimal 12 karakter, tolak sandi umum.
- Sesi JWT berumur 1 jam (Credentials memaksa JWT). `requireUser()` membaca ulang `role`/`plan` dari DB; token hanya memuat ID.
- Anti-enumerasi: respons daftar sama baik email sudah terdaftar maupun belum; login menjawab generik dengan waktu mirip.
- Rate limit login (per email dan per IP) dan daftar (per IP), dengan kunci di-hash.
- Halaman `/daftar`, `/masuk`, dan `/dashboard` (terproteksi; placeholder) + tombol keluar.

**Tidak termasuk:** verifikasi email, reset sandi, Google SSO, profil/slug, admin, CAPTCHA, cek sandi bocor (HIBP). Pendaftaran tidak langsung login; pengguna diarahkan ke `/masuk`.

Dependensi (pin tanpa `^`): `next-auth@5.0.0-beta.32`, `@node-rs/argon2`.

## Scope Teknis
| Lapisan | File |
|---|---|
| Halaman/Komponen | `src/app/(public)`-setara: `src/app/daftar`, `src/app/masuk`, `src/app/(app)/layout.tsx` + `dashboard`, `src/components/auth/*` |
| Action | `src/actions/auth.ts` |
| Auth config | `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts` |
| Service | `src/server/auth/{guards,password,rate-limit}.ts`, `src/server/user/service.ts` |
| Validasi | `src/lib/validation/auth.ts`, `src/lib/auth/{redirect,common-passwords}.ts` |
| DB | `prisma/schema.prisma` (`RateLimitBucket`) + migrasi baru |
| Env | `src/lib/env.schema.ts` (`AUTH_SECRET`), `.env.example` (oleh user) |
| Proxy | `src/proxy.ts` (pagar kasar `/dashboard`) |
| Tes | `tests/auth-*.test.ts`, `e2e/auth.spec.ts`, `e2e/auth-flow.spec.ts` (butuh DB, dilewati di CI) |
| CI | `.github/workflows/ci.yml` (nilai env palsu untuk build) |

## Acceptance Criteria
- [x] Daftar valid membuat user dengan `passwordHash` Argon2id; `role=USER`, `plan=FREE` tidak bisa diisi dari input (teruji unit; ujung-ke-ujung ke DB: lihat verifikasi tertunda)
- [x] Email sudah terdaftar dan email baru menghasilkan respons daftar yang identik (pesan dan jalur)
- [x] Login benar masuk ke `/dashboard`; salah (email/sandi) menampilkan pesan generik yang sama
- [x] `/dashboard` tanpa sesi diarahkan ke `/masuk?next=...`; parameter `next` hanya menerima path relatif satu-origin
- [x] `requireUser()` menolak tanpa sesi dan saat user sudah tidak ada di DB; `role` dari DB, bukan token
- [x] Rate limit login/daftar aktif dan berlaku juga untuk endpoint Auth.js langsung
- [x] Cookie sesi `httpOnly`, `sameSite=lax`, `secure` di production; tanpa `allowDangerousEmailAccountLinking`
- [x] Build dan CI hijau tanpa rahasia nyata

## Verifikasi
- [x] `npm run lint` dan `npm run typecheck` lulus
- [x] `npm run test` lulus: berhasil, input tidak valid, akses ditolak
- [x] `npm run test:e2e` lulus (alur tanpa DB)
- [ ] Alur penuh dengan DB (`E2E_WITH_DB=1`) lulus terhadap Neon dev (menunggu `AUTH_SECRET` di `.env.local` oleh user)
- [x] `npm run build` lulus
- [ ] Migrasi `RateLimitBucket` diterapkan di Neon dev (`npm run db:migrate`, oleh user)
- [x] `npm audit --omit=dev` tanpa High/Critical

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff; `.env.example` hanya nilai palsu
- [x] Input divalidasi Zod di server (`.strict()`, batas panjang)
- [x] Tes: berhasil, tidak valid, akses ditolak
- [x] Pesan error generik; tidak membocorkan keberadaan akun
- [x] Endpoint rawan abuse berlimit laju
- [x] Dependensi disetujui, versi dikunci, `npm audit` bersih

## Definition of Done
- [ ] Semua AC terpenuhi (kecuali dua butir verifikasi DB di atas)
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan (diff diperiksa)

# LOCAL-20261110-prisma-database — Prisma, skema database, dan migrasi awal

> **Area:** DB
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Tanggal mulai perbaikan:** 2026-11-10 (catatan penerapan migrasi)
> **Status:** Done
> **Implementasi:** [LOCAL-20261110-prisma-database](../implementations/LOCAL-20261110-prisma-database.md)
> **Branch:** feature/prisma-database
> **Dampak keamanan:** Data pribadi, Dependensi, Otorisasi (kepemilikan data)

## Deskripsi
Fondasi data (SRS §4 butir 1): Prisma + koneksi PostgreSQL (Neon, project dev) + model awal + migrasi awal. Dipakai oleh tiket Auth, Profil, Paket/Add-on, dan Portofolio berikutnya.

Model awal: `User` (role, plan, `passwordHash` opsional), `Profile` (slug unik, WhatsApp, bio), `ServicePackage`, `Addon`, `PortfolioItem`. Semua data milik pengguna punya `ownerId`/`userId` + indeks. Model Auth.js (`Account`, `Session`, `VerificationToken`) ditambah di tiket Auth lewat migrasi tersendiri.

Dependensi disetujui user (10 Nov 2026), versi dikunci: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `prisma`, `@types/pg` di 7.10.1 / 8.x stabil (bukan 8.0.0-rc).

**Tidak termasuk:** Auth.js, rate limit, logika bisnis Free tier, seed data, penerapan migrasi ke Neon (dijalankan user), DB production.

## Scope Teknis
| Lapisan | File |
|---|---|
| DB | `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/*` |
| Koneksi | `src/lib/db.ts` (server-only, singleton) |
| Env | `src/lib/env.schema.ts`, `src/lib/env.ts`, `.env.example` (nama variabel + nilai palsu) |
| Tes | `tests/env.test.ts` (variabel DB), tes skema/koneksi bila memungkinkan |
| CI | `package.json` (skrip, `postinstall: prisma generate`), `.github/workflows/ci.yml` bila perlu generate |

## Acceptance Criteria
- [x] `prisma validate` dan `prisma generate` lulus; klien ter-generate tidak ikut di-commit bila berada di folder generated (atau sesuai keputusan di dokumen implementasi)
- [x] Skema mengikuti `RULES_DB.md` §2 (cuid, `@map`/`@@map`, `ownerId` + indeks, enum, `@@unique([ownerId, slug])`/slug unik di DB)
- [x] `src/lib/db.ts` singleton, `import "server-only"`, log production hanya error/warn
- [x] `DATABASE_URL` dan `DIRECT_URL` divalidasi di `env.ts` (Zod); nilai tidak pernah tercetak
- [x] Migrasi awal ada dan SQL ditinjau (dibuat dengan `migrate diff`, tanpa koneksi DB)
- [x] Migrasi diterapkan dari DB kosong di Neon dev (branch `development`), dijalankan user
- [x] CI tetap hijau tanpa rahasia DB (build tidak butuh koneksi)

## Verifikasi
- [x] `npm run lint` dan `npm run typecheck` lulus
- [x] `npm run test` lulus
- [x] `npm run build` lulus
- [x] Migrasi diuji dari DB kosong di database dev (DB berisi data contoh: dilewati, tabel masih kosong)
- [x] `npm audit --omit=dev` tanpa High/Critical

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff; `.env.example` hanya nilai palsu
- [x] Dependensi: hanya yang disetujui, versi dikunci, `npm audit` bersih
- [x] Tidak ada data sensitif ke log; TLS wajib (`sslmode=require`)

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan (diff diperiksa)

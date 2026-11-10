# LOCAL-20261110-prisma-database — Implementasi

**Branch:** feature/prisma-database  **Tanggal:** 2026-11-10  **PR:** (diisi setelah dibuka)

## Ringkasan
Fondasi data: Prisma 7.10.1 + adapter `pg`, skema awal (User, Profile, ServicePackage, Addon, PortfolioItem), klien singleton server-only, validasi `DATABASE_URL`, dan berkas SQL migrasi awal. Migrasi **belum diterapkan** ke database nyata karena `.env.local` belum ada.

## File yang Berubah
- `prisma/schema.prisma`: model + enum sesuai `RULES_DB.md` §2 (cuid, `@map`/`@@map`, `owner_id` + indeks, FK `onDelete: Cascade`).
- `prisma/migrations/20261110000000_init/migration.sql`, `prisma/migrations/migration_lock.toml`: dibuat dengan `prisma migrate diff --from-empty --to-schema` (tanpa koneksi DB).
- `prisma.config.ts`: URL migrasi dari `DIRECT_URL`; memuat `.env.local` bila ada.
- `src/lib/db.ts`: `PrismaClient` singleton + `PrismaPg`, `import "server-only"`, log hanya error/warn.
- `src/lib/env.schema.ts`: `DATABASE_URL` wajib dan harus URL PostgreSQL. `tests/env.test.ts` disesuaikan + tes baru.
- `package.json`/`package-lock.json`: dependensi dikunci (tanpa `^`), skrip `postinstall` (`prisma generate`), `db:validate`, `db:migrate`.
- `.gitignore`, `.prettierignore`, `eslint.config.mjs`: abaikan `src/generated/` (klien hasil generate, tidak di-commit).

## Keputusan Desain
- **Prisma 7.10.1, bukan `latest`**: tag `latest` di npm saat ini 8.0.0-rc.33 (release candidate). Disetujui user.
- **`DIRECT_URL` tidak masuk `serverEnv`**: hanya CLI migrasi yang membacanya, sehingga kredensial DDL tidak ada di runtime (RULES_SECURITY §8.2).
- **`Addon.ownerId` disalin dari paket induk** agar kepemilikan bisa disaring langsung di query (anti-IDOR). Konsistensi dengan paket induk wajib dijaga service pada tiket CRUD.
- Batas Free tier, regex slug, dan validasi harga ≥ 0 ditegakkan di service/Zod pada tiket terkait, bukan constraint DB.
- Model Auth.js (`Account`, `Session`, `VerificationToken`) ditunda ke tiket Auth (migrasi terpisah).
- `process.loadEnvFile` di `prisma.config.ts` (di luar `env.ts`) karena CLI Prisma berjalan di luar Next; tidak mencetak nilai.

## Dampak Keamanan
Data pribadi (email, hash sandi, nomor WhatsApp) kini punya kolom di skema; belum ada kode yang membaca/menulisnya. Tidak ada rahasia di diff. `.env.example` **belum diperbarui** (izin menolak penulisan oleh Claude); lihat Open Question. Checklist §13: dependensi disetujui, versi dikunci, `npm audit --omit=dev` bersih.

## Verifikasi
- `npx prisma validate` → lulus; `npx prisma generate` → lulus
- `npm run lint` → lulus; `npm run typecheck` → lulus
- `npm run test` → 150/150 lulus (PowerShell)
- `npm run build` → lulus (dengan `NEXT_PUBLIC_SITE_URL`)
- `npm audit --omit=dev --audit-level=high` → 0 kerentanan
- SQL migrasi ditinjau: hanya `CREATE`, tanpa `DROP`/perubahan destruktif
- **Dilewati:** migrasi dari DB kosong dan DB berisi data contoh (tidak ada database; belum ada `.env.local`). Skema belum pernah dijalankan ke PostgreSQL sungguhan.
- `npm run test:e2e` → dilewati lokal (tidak menyentuh UI); dijalankan CI

## Open Question
1. User membuat project Neon dev, mengisi `DATABASE_URL` (host `-pooler`) dan `DIRECT_URL` (tanpa `-pooler`) di `.env.local`, lalu menjalankan `npm run db:migrate` dan melaporkan hasilnya (atau meminta Claude menjalankannya setelah `.env.local` ada dan dipastikan menunjuk DB dev).
2. Tambahkan ke `.env.example` (oleh user): `DATABASE_URL=postgresql://user:password@ep-example-pooler.region.aws.neon.tech/db?sslmode=require` dan `DIRECT_URL=postgresql://user:password@ep-example.region.aws.neon.tech/db?sslmode=require`.
3. Tambahkan `DATABASE_URL` (pooled) ke Environment Variables Vercel **hanya** saat kode mulai memakai `db`; jangan `DIRECT_URL` di Vercel.

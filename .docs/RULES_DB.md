# RULES_DB.md — Aturan Database (PostgreSQL + Prisma, Supabase / Neon)

> Dibaca saat membuat atau mengubah skema, migrasi, atau koneksi. Keamanan data: `RULES_SECURITY.md` §8.

---

## 1. Prinsip

1. Claude bekerja **hanya** dengan database **lokal/sementara** (mis. Postgres Docker `localhost`, atau branch dev Neon) yang disebut user. **Tidak pernah** menyentuh database production atau yang dipakai bersama; operasi ke sana hanya oleh user.
2. `DATABASE_URL` di `.env.local` harus menunjuk ke DB dev. Jika ragu apakah suatu URL production, **berhenti dan tanya** sebelum menjalankan perintah Prisma apa pun.
3. Semua perubahan skema lewat **migrasi Prisma** (`prisma/migrations/`), di-commit bersama kode. Tidak ada perubahan manual di konsol Supabase/Neon, dan tidak memakai `db push` untuk skema yang akan dibagikan.
4. Satu perubahan skema = satu migrasi bernama deskriptif. **Jangan mengubah migrasi yang sudah di-merge**; buat migrasi baru.
5. Perintah yang ditolak hook dan hanya dijalankan user: `prisma migrate reset`, `db push --accept-data-loss`/`--force-reset`, `migrate deploy`, `db execute`. **[hook]**
6. Perubahan merusak (drop kolom/tabel berisi data, ubah tipe, tambah `NOT NULL` tanpa default) memakai pola **expand → migrate → contract** dalam rilis terpisah dan butuh persetujuan user.

---

## 2. Konvensi skema (`schema.prisma`)

| Hal | Konvensi |
|---|---|
| Model | `PascalCase` tunggal (`Project`), `@@map("projects")` snake_case jamak |
| Kolom | `camelCase` di Prisma, `@map("snake_case")` di DB |
| Primary key | `id String @id @default(cuid())` (atau `uuid()`); tidak memakai ID berurutan yang bisa ditebak untuk resource yang terekspos di URL |
| Waktu | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`; semua UTC |
| Relasi | Foreign key eksplisit + `onDelete` yang disengaja (`Cascade` hanya untuk data milik penuh induknya) |
| Enum | `enum Role { USER ADMIN }`; nilai baru lewat migrasi |
| Kepemilikan | Model data pengguna punya `ownerId` + `@@index([ownerId])`; query selalu menyaring `ownerId` (`RULES_SECURITY.md` §3) |
| Indeks/unik | `@@unique` untuk aturan bisnis (mis. `[ownerId, slug]`), `@@index` untuk kolom filter/urut yang sering; unik ditegakkan di DB, bukan hanya di kode |
| Data sensitif | Hash (bukan plaintext) untuk token reset/verifikasi; kolom rahasia dienkripsi aplikasi; **jangan** menyimpan sandi plaintext |
| Soft delete | Hanya bila ada kebutuhan bisnis; bila dipakai, **semua** query menyaring `deletedAt: null` lewat satu helper |

Model Auth.js (`User`, `Account`, `Session`, `VerificationToken`) mengikuti skema resmi Prisma Adapter; tambahan kolom (`role`) tidak boleh bisa diubah dari input pengguna.

---

## 3. Koneksi (Supabase / Neon)

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled: runtime aplikasi
  directUrl = env("DIRECT_URL")     // langsung: migrasi
}
```

| | `DATABASE_URL` (runtime) | `DIRECT_URL` (migrasi) |
|---|---|---|
| Supabase | pooler (port 6543) + `?pgbouncer=true&connection_limit=1` | host langsung (port 5432) |
| Neon | host `-pooler` | host tanpa `-pooler` |

- `sslmode=require` pada keduanya. Singleton `PrismaClient` di `src/lib/db.ts` (cegah koneksi berlipat saat hot reload); berkas itu `import "server-only"`.
- Role aplikasi runtime ≠ role migrasi (least privilege, `RULES_SECURITY.md` §8.2).
- Supabase: Prisma melewati RLS (konek sebagai role Postgres). Otorisasi tetap di kode; Data API/`anon` dimatikan atau RLS aktif di semua tabel (`RULES_SECURITY.md` §8.3).
- `log` Prisma di production hanya `error`/`warn` (query log bisa memuat data pribadi).

---

## 4. Alur migrasi

```bash
# lokal, terhadap DB dev
npx prisma migrate dev --name tambah_tabel_project     # buat + terapkan migrasi
npx prisma generate
npx prisma validate && npx prisma format
```

- Tinjau SQL hasil `migrations/*/migration.sql` sebelum commit (cari `DROP`, `ALTER ... NOT NULL`, perubahan tipe).
- **Tes migrasi**: terapkan dari DB kosong **dan** dari DB berisi data contoh (`seed`) pada database lokal sementara bernama unik; hapus DB sementara itu dengan nama persis setelah selesai. Laporkan hasilnya di dokumen implementasi.
- Penerapan ke staging/production: **user** menjalankan `prisma migrate deploy` (atau CI terproteksi) setelah PR di-merge dan backup/PITR dipastikan. Claude tidak menjalankannya.
- `prisma/seed.ts` hanya data contoh non-sensitif dan **tidak pernah** dijalankan terhadap production; tanpa akun admin dengan sandi bawaan.

---

## 5. Kueri

- Pakai Prisma Client; raw SQL hanya tagged template (`RULES.md` §4, `RULES_SECURITY.md` §4.2).
- Pilih kolom eksplisit (`select`) untuk data yang melintasi batas server→klien; jangan mengembalikan model utuh.
- Paginasi wajib; `take` ≤ 100. Hindari N+1.
- Penulisan multi-langkah atau cek-lalu-tulis: `$transaction` dan/atau constraint unik / `updateMany` bersyarat untuk menghindari race condition.
- Penomoran/ID bisnis dibuat di service atau constraint DB, bukan dihitung dari `COUNT`.

# RULES.md — Aturan Inti ServiceShowcase

> Stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, Server Actions / Route Handlers, PostgreSQL (Supabase / Neon) + Prisma, Auth.js (NextAuth), Cloudflare R2.
> Keamanan: `RULES_SECURITY.md` (berlaku di atas aturan lain). Template: `RULES_TEMPLATES.md`. UI: `RULES_FRONTEND.md`. DB: `RULES_DB.md`.
> Ikuti **versi yang terpasang** di `package.json`; bila API berbeda antar versi (mis. `params`/`searchParams` berupa `Promise` dan wajib di-`await` sejak Next 15; `middleware.ts` diganti nama menjadi `proxy.ts` di Next 16; Auth.js v5 `auth()`). Next.js membawa dokumentasi versinya di `node_modules/next/dist/docs/`, gunakan itu sebagai rujukan, cek dokumentasi versi itu, jangan menebak.

---

## 1. Struktur proyek

```
src/
  app/                    # routing App Router (page.tsx, layout.tsx, route.ts, loading/error)
    (public)/             # halaman publik
    (app)/                # halaman yang butuh login (layout memanggil requireUser())
    api/                  # Route Handler (webhook, upload presign, dll.)
  components/
    ui/                   # komponen dasar tanpa logika bisnis (Button, Input, Dialog)
    <fitur>/              # komponen per fitur
  server/                 # SERVER ONLY (setiap berkas: import "server-only")
    auth/                 # requireUser(), requireRole(), helper otorisasi
    <fitur>/              # service + query per fitur (akses Prisma di sini saja)
    storage/              # klien R2, presign
  actions/                # Server Actions per fitur ("use server")
  proxy.ts                # Next 16 (dulu middleware.ts): CSP ber-nonce + pagar kasar
  lib/
    env.schema.ts         # skema Zod env (murni, bisa diuji)
    env.ts                # satu-satunya pembaca process.env server (server-only)
    env.client.ts         # nilai NEXT_PUBLIC_* (publik, tanpa rahasia)
    db.ts                 # singleton PrismaClient (server-only)
    validation/           # skema Zod bersama (dipakai form klien dan server)
    utils.ts
  types/
prisma/
  schema.prisma
  migrations/
e2e/                      # Playwright
tests/                    # Vitest (unit/integrasi)
```

- `src/server/**` dan `src/lib/db.ts`, `src/lib/env.ts` (bagian rahasia) diawali `import "server-only";` agar build gagal bila terimpor Client Component.
- Alias impor `@/` → `src/`. Tidak ada impor relatif berjenjang `../../..`.

---

## 2. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. **Tanpa `any`**; gunakan `unknown` lalu persempit (Zod `parse`/`safeParse`). `// @ts-ignore` dan `as` untuk membungkam error dilarang; `// @ts-expect-error` hanya dengan alasan.
- `ignoreBuildErrors` / `ignoreDuringBuilds` di `next.config` **dilarang**.
- Tipe data turunan dari Zod (`z.infer`) atau Prisma (`Prisma.XGetPayload`), bukan ditulis ulang manual.
- Nama: berkas `kebab-case.ts(x)`, komponen `PascalCase`, fungsi/variabel `camelCase`, konstanta `UPPER_SNAKE_CASE`, tabel/kolom DB lewat `@map` snake_case (lihat `RULES_DB.md`).

---

## 3. Server vs Client

1. **Server Component adalah default.** `"use client"` hanya untuk interaktivitas (state, efek, event handler, API browser) dan ditaruh serendah mungkin di pohon komponen.
2. Data diambil di Server Component lewat fungsi `src/server/<fitur>/*`, bukan lewat `fetch` ke API sendiri.
3. **Props ke Client Component hanya data yang boleh dilihat pengguna.** Pilih kolom eksplisit (`select`/DTO); jangan mengoper objek Prisma utuh (mis. `passwordHash`, `email` orang lain, `role`).
4. Server Action: satu berkas per fitur di `src/actions/`, diawali `"use server"`, **hanya mengekspor fungsi async** (semua ekspor Server Action adalah endpoint publik; fungsi bantu non-aksi ditaruh di `src/server/`).
5. Route Handler (`route.ts`) hanya untuk: webhook, endpoint yang dipanggil pihak luar, streaming, atau presign upload. Mutasi dari UI sendiri memakai Server Action.
6. Mutasi diakhiri `revalidatePath`/`revalidateTag` yang tepat sasaran; jangan `revalidatePath('/')` serampangan.
7. Caching: ikuti default versi terpasang, tetapi data **spesifik pengguna tidak boleh ikut cache bersama** (`unstable_cache`/`fetch` cache). Halaman yang membaca `cookies()`/`headers()`/session otomatis dinamis; jangan memaksa statis.

---

## 4. Lapisan data

- **Hanya `src/server/<fitur>/` yang mengimpor Prisma.** Action/route memanggil fungsi service ini; Client Component tidak pernah.
- Satu fungsi = satu tujuan jelas (`getProjectForUser(userId, id)`, bukan `getProject(id)`). **Fungsi baca/ubah resource milik pengguna menerima `userId` (atau `actor`) dan memfilternya di `where`** — otorisasi ikut di query (lihat `RULES_SECURITY.md` §3).
- Transaksi (`prisma.$transaction`) untuk penulisan lebih dari satu tabel atau yang harus atomik (cek-lalu-tulis → pakai constraint unik/`updateMany` bersyarat, bukan baca-lalu-update).
- **Paginasi wajib** untuk daftar (`take` ≤ 100, cursor atau offset); tidak ada `findMany` tanpa batas di endpoint yang bisa dipicu pengguna.
- Hindari N+1: `include`/`select` terarah atau `in` batch.
- Raw SQL hanya dengan tagged template `Prisma.sql` / `` prisma.$queryRaw`...${x}` ``; identifier dinamis (nama kolom/urutan) dicocokkan ke daftar putih.

---

## 5. Validasi dan hasil Server Action

- Skema Zod di `src/lib/validation/<fitur>.ts`; dipakai klien (UX) **dan** diulang di server (keamanan). `schema.safeParse(Object.fromEntries(formData))` / `schema.parse(input)`. Gunakan `.strict()` untuk menolak field tak dikenal, batasi `max()` pada string/array.
- Bentuk hasil seragam, jangan melempar error mentah ke klien:

```ts
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "CONFLICT" | "INTERNAL"; message: string; fieldErrors?: Record<string, string[]> };
```

- `message` aman dibaca pengguna dan **tidak membocorkan detail** (query, stack, apakah email terdaftar). Detail teknis ke log server.
- Gunakan `useActionState`/`useFormStatus` di form; tombol submit dinonaktifkan saat pending (cegah kirim ganda; aksi sensitif tetap idempoten di server).

---

## 6. Testing

- **Vitest** untuk unit dan integrasi (skema Zod, service, fungsi otorisasi, helper presign); **Playwright** untuk alur pengguna (E2E). Tes tidak boleh memanggil layanan produksi.
- Integrasi DB memakai database lokal/sementara bernama unik (`RULES_DB.md`), bukan Supabase/Neon production.

**Minimum tes per pekerjaan:**

| Jenis perubahan | Minimum |
|---|---|
| Server Action / Route Handler baru atau diubah | Vitest: 1 jalur berhasil + 1 input tidak valid + **1 akses ditolak** (belum login atau bukan pemilik) |
| Fitur otorisasi/auth/upload | Di atas + tes **IDOR** (pengguna A tidak bisa membaca/ubah resource pengguna B) dan, untuk upload, tolak tipe/ukuran salah |
| Halaman/alur UI baru | 1 skenario Playwright jalur berhasil + 1 jalur gagal (validasi atau akses ditolak) |
| Perbaikan bug | 1 tes yang mereproduksi bug dan lulus setelah perbaikan |
| Migrasi DB | `migrate` diuji dari DB kosong dan dari DB berisi data contoh; hasil dilaporkan |
| Dependensi | `npm audit --omit=dev` + `npm run build` |

Jika minimum tidak bisa dipenuhi, tulis alasannya di dokumen implementasi; jangan dilewati diam-diam.

---

## 7. Gaya kode dan dependensi

- Format otomatis (Prettier + `prettier-plugin-tailwindcss`) dan ESLint (`next/core-web-vitals`, `@typescript-eslint/strict`, `eslint-plugin-security` bila dipakai). **Jangan** `eslint-disable` aturan keamanan.
- Diff kecil dan fokus; jangan reformat berkas yang tidak terkait. Jangan menghapus kode lama yang tidak terkait; tandai temuan untuk dibahas terpisah.
- Komentar dan pesan ke user dalam bahasa Indonesia; identifier dalam bahasa Inggris atau istilah domain. Komentar menjelaskan **mengapa**, bukan apa.
- Tanpa `console.log` tertinggal; logging lewat `src/lib/logger.ts` (tanpa data sensitif).
- **Menambah dependensi butuh persetujuan user.** Sebelum mengusulkan: cek kegunaan nyata (bisa pakai API bawaan/library yang sudah ada?), pemeliharaan (rilis terakhir, maintainer), ukuran bundel (untuk klien), skrip `postinstall`, dan kerentanan. Pin versi lewat lockfile (`package-lock.json` selalu ikut commit); pasang dengan `npm ci` di CI.

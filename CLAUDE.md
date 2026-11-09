# CLAUDE.md — ServiceShowcase

> Next.js 14+ (App Router) + Tailwind CSS | Server Actions / Route Handlers | PostgreSQL (Supabase / Neon) + Prisma | Auth.js (NextAuth) | Cloudflare R2 | TypeScript strict
> Repo: GitHub. Alur: `feature/*` → PR → `development` (integrasi) → PR → `main` (rilis). `development` dan `main` diproteksi | Deploy: Vercel (preview per PR, production dari `main`)

**BAHASA INDONESIA** untuk semua komunikasi ke user. Kode, nama file, dan perintah teknis → English.

Dokumen acuan (baca sesuai kebutuhan, jangan semuanya):
- `.docs/RULES.md` — aturan inti (wajib selalu)
- `.docs/RULES_SECURITY.md` — keamanan (wajib selalu; berlaku di atas aturan lain bila bertentangan)
- `.docs/RULES_TEMPLATES.md` — template Server Action, Route Handler, Server Component, akses data
- `.docs/RULES_FRONTEND.md` — komponen, Tailwind, form, aksesibilitas (baca bila menyentuh UI)
- `.docs/RULES_DB.md` — skema Prisma, migrasi, koneksi Supabase/Neon (baca bila menyentuh DB)
- `.docs/TICKET.md` — format tiket dan dokumen implementasi

---

## 0. Cara kerja dengan user

- **Tanya dulu untuk keputusan yang milik user** (arsitektur, library baru, perubahan skema, perubahan perilaku auth, biaya/layanan baru). Untuk hal yang punya default konvensional, pilih defaultnya dan sebutkan di ringkasan.
- Jangan menyentuh database, bucket R2, atau layanan nyata (Supabase/Neon production, R2 production, Vercel project settings). Pekerjaan memakai database **lokal/branch dev** dan bucket **dev**. Operasi ke lingkungan nyata hanya oleh user atau atas izin eksplisit.
- **Rahasia tidak pernah ditulis, dibaca, atau dicetak oleh Claude**: `.env*`, kunci privat, token, connection string. Claude hanya memperbarui `.env.example` (nama variabel + nilai palsu). User mengisi `.env.local` sendiri. Hook dan `permissions.deny` menegakkan ini; jangan mencoba menghindarinya, laporkan ke user.
- **Dilarang** menambahkan atribusi Claude/AI (`Co-Authored-By`, "Generated with Claude Code", dsb.) di commit, kode, PR, atau dokumen.
- Stage file **per nama**; dilarang `git add -A` / `git add .`.

---

## 1. Jalur kerja

Satu jalur: **tiket lokal**. ID: `LOCAL-YYYYMMDD-slug`, mis. `LOCAL-20261110-login-google`. Tanpa OpenProject. Jika user tidak menyebut nama pekerjaan yang jelas, usulkan slug dan minta konfirmasi.

---

## 2. Gate sequence

```
[A] TIKET     → baca/buat .docs/tickets/<ID>.md
      ↓
[B] BRANCH    → checkout development, pull, buat branch kerja
      ↓
[C] MULAI     → tiket: In Progress + Tanggal mulai
      ↓
[D] RULES     → baca RULES.md + RULES_SECURITY.md (+ RULES_TEMPLATES / FRONTEND / DB sesuai layer)
      ↓
[E] KODE      → baru boleh menulis kode
      ↓
[F] VERIFIKASI + TIKET DONE → jalankan §4; tiket Done + checklist; buat .docs/implementations/<ID>.md
      ↓
[G] COMMIT    → pre-commit gate (§5); satu commit per tiket
[H] PUSH + PR → push branch kerja, buka PR ke development via `gh`; user yang me-review dan merge
```

- **[A]** Jika tiket belum ada, buat berdasarkan penjelasan user (format `.docs/TICKET.md`).
- **[B]** `git checkout development && git pull`, lalu `git checkout -b {type}/{slug}`; `type` = `feature`, `fix`, `chore`, `security`, `docs`. `{slug}` **harus sama** dengan slug pada nama tiket (hook mencocokkan lewat nama branch).
- **[C]** Hook `gate-ticket.js` menolak edit di `src/`, `app/`, `components/`, `lib/`, `prisma/`, `tests/`, `e2e/`, `public/`, `middleware.ts`, `next.config.*`, `auth.ts`, `package.json` bila tiket belum `In Progress` atau RULES + RULES_SECURITY belum dibaca.
- **[F]** Sebelum menyatakan selesai: tiket `Status: Done`, `**Tanggal selesai:**`, `**Implementasi:** [<ID>](../implementations/<ID>.md)`, centang AC, dan buat dokumen implementasi.
- **[G]/[H]** Claude **boleh** commit dan push ke branch kerja serta membuka PR (izin tetap dari user, 9 Nov 2026), dengan batas di §5. Merge PR selalu oleh user.

---

## 3. Keamanan (ringkasan; detail dan checklist di `RULES_SECURITY.md`)

Aturan keras, tanpa pengecualian tanpa persetujuan user:

1. **Tidak ada rahasia di repo atau di bundel klien.** Hanya variabel `NEXT_PUBLIC_*` yang boleh ke browser, dan tidak pernah berisi rahasia. Semua env dibaca lewat satu modul tervalidasi (`src/lib/env.ts`, Zod), bukan `process.env` tersebar.
2. **Semua input tidak tepercaya**: setiap Server Action, Route Handler, dan search param divalidasi dengan **Zod di server** sebelum dipakai.
3. **Otentikasi + otorisasi di server pada setiap Server Action dan Route Handler**, termasuk cek **kepemilikan resource** (cegah IDOR). Middleware bukan satu-satunya pagar. Server Action adalah endpoint publik.
4. **Akses data hanya lewat lapisan data server** (`src/server/**`, `import "server-only"`). Prisma tidak dipanggil dari Client Component. Tidak ada raw SQL berinterpolasi (`$queryRawUnsafe` dilarang).
5. **Upload R2 lewat presigned URL kedaluwarsa singkat**, tipe/ukuran divalidasi di server, key dibuat server (bukan nama berkas user), bucket privat.
6. **Tidak ada `dangerouslySetInnerHTML`, `eval`, `innerHTML`** dengan data user.
7. **Header keamanan + CSP** aktif, cookie `httpOnly` + `secure` + `sameSite`, **rate limit** di login, pendaftaran, reset sandi, dan endpoint tulis.
8. **Dependensi**: tidak menambah paket tanpa persetujuan user; versi dikunci (lockfile ikut commit); `npm audit --omit=dev` bersih untuk High/Critical.
9. **Error ke klien generik**; detail hanya di log server tanpa data sensitif.

Hook penegak: `guard-code.js` (pola berbahaya saat menulis), `guard-git.js` (git/gh/prisma berbahaya, rahasia di staged diff), `check-env.js` (cek `.gitignore` dan berkas rahasia ter-track). Pengecualian satu baris hanya dengan komentar `// sec-ok: <alasan>` dan akan disorot di review.

---

## 4. Verifikasi sebelum menyatakan selesai

Jalankan yang relevan dan laporkan hasil apa adanya (lulus/gagal/dilewati):

```bash
npm run lint
npm run typecheck          # tsc --noEmit
npm run test               # Vitest (unit + integrasi)
npm run test:e2e           # Playwright, bila menyentuh alur pengguna
npm run build              # wajib bila menyentuh next.config, middleware, route, atau env
npm audit --omit=dev       # bila menambah/mengubah dependensi
```

- **Minimum tes per pekerjaan**: lihat `RULES.md` §6 (jalur berhasil + jalur gagal; fitur yang menyentuh auth/otorisasi wajib punya tes **akses ditolak**).
- Perubahan skema: migrasi Prisma diuji di database lokal sementara (`RULES_DB.md`).
- Jika script belum ada (proyek belum di-scaffold), katakan terus terang; jangan mengklaim lulus.
- **Review perubahan** (hanya jika user meminta): `python .code-reviewer/reviewer_local.py` (default `--base development`; untuk PR rilis pakai `--base main`). Perlu `.code-reviewer/.env` berisi `GEMINI_API_KEY` (contoh di `.env.example`); jangan menulis atau menebak key. Diff dikirim ke layanan eksternal; beri tahu user bila diff berisi data sensitif.

---

## 5. Git

**Diizinkan untuk Claude** (di branch kerja saja): `git add <file>`, `git commit`, `git push -u origin <branch>`, `gh pr create`, `gh pr view/checks`.

**Dilarang** (hook menolak): commit/push di atau ke `main` dan `development`; `--force` (hanya `--force-with-lease` pada branch kerja sendiri); `--no-verify`; `git add .`/`-A`; `gh pr merge`; mengubah repo/secret/ruleset GitHub; rewrite riwayat; `prisma migrate reset` / `migrate deploy`.

**Pre-commit gate** (jalankan sebelum tiap commit):
1. `git status` + `git diff` dibandingkan dengan scope tiket; tidak ada berkas di luar scope.
2. Tidak ada rahasia: `.env*`, kunci, token, connection string (hook memindai diff staged).
3. `lint` + `typecheck` + `test` lulus (§4), tiket Done, dokumen implementasi ada.
4. Stage per nama berkas.

**Format commit** (Conventional Commits, deskripsi bahasa Indonesia): `type(scope): deskripsi singkat`, mis. `feat(auth): login dengan Google`, `fix(upload): tolak berkas melebihi 5 MB`, `security(api): tambah rate limit pendaftaran`. Satu commit per tiket. Tanpa atribusi AI.

**Alur PR**: push branch → `gh pr create --base development` (judul = judul commit; isi: ringkasan, cara uji, dampak keamanan, link tiket; tanpa atribusi AI) → tunggu CI hijau → **user me-review dan merge**. Satu PR = satu tiket. Branch dihapus setelah merge oleh user.

**Rilis**: setelah beberapa tiket menumpuk di `development` dan diuji (preview Vercel + tes), user meminta PR promosi `development` → `main`. Claude boleh membukanya (`gh pr create --base main --head development`) hanya atas permintaan itu; merge oleh user, tanpa squash yang menghapus riwayat `development` (disarankan *merge commit*). Hotfix mendesak: `fix/*` dari `main` → PR ke `main`, lalu `main` digabung balik ke `development`.

---

## 6. Perintah efektif

| Situasi | Pola |
|---|---|
| Mulai | `"Kerjakan: {deskripsi}. Ikuti gate sequence dari awal."` |
| Lanjut | `"Lanjutkan {ID}, branch sudah ada di {branch}."` |
| Review keamanan | `"Review keamanan perubahan di branch ini terhadap RULES_SECURITY.md."` |
| Tanpa commit | `"Kerjakan sampai verifikasi saja, jangan commit."` (user bisa menahan kapan saja) |

---

## 7. Catatan yang belum selesai

- Proyek **belum di-scaffold** (belum ada `package.json`, Next.js, Prisma). Langkah awal yang disarankan, masing-masing satu tiket: (1) scaffold Next.js + TypeScript strict + Tailwind + ESLint + Vitest + Playwright; (2) `src/lib/env.ts` + `.env.example`; (3) Prisma + koneksi DB (`RULES_DB.md` §3); (4) Auth.js; (5) security headers + CSP + rate limit; (6) upload R2.
- **Belum ada di GitHub (perlu dibuat user atau tiket tersendiri):** branch protection `main` **dan `development`** (wajib PR, status check wajib, tanpa force push), GitHub Actions CI (`lint`, `typecheck`, `test`, `build`, `npm audit`, secret scan seperti gitleaks), Dependabot, secret scanning + push protection, 2FA akun. Claude tidak mengubah pengaturan repo; user yang mengaktifkan.
- Remote `origin` = `https://github.com/RisqiAlamsyah/ServiceShowcase.git` (terkonfirmasi 9 Nov 2026). **GitHub CLI (`gh`) belum terpasang** di mesin ini: sebelum Gate [H] bisa membuka PR, user perlu `winget install GitHub.cli` lalu `gh auth login` (login atas nama user; Claude tidak menyimpan token). Sampai itu ada, Claude berhenti setelah `git push` dan memberi link untuk membuka PR manual.
- Branch `development` dibuat dari `main` (`82d7587`) dan sudah di-push ke GitHub (9 Nov 2026). Atur `development` sebagai default branch di GitHub bila ingin PR otomatis menuju ke sana (pengaturan repo = tugas user).
- `.code-reviewer/` sudah diselaraskan ke stack ini; model dan `GEMINI_API_KEY` mengikuti pilihan user.

---

## 8. Work Summary (wajib setelah setiap task)

```
RINGKASAN KERJA:
Yang Dikerjakan: [detail]
File yang Terpengaruh: [path]: [deskripsi]
Hasil Akhir: [status]
Verifikasi: [perintah → hasil, termasuk yang gagal/dilewati]
Dampak Keamanan: [auth/input/data/upload yang tersentuh, atau "tidak ada"]
Catatan Penting (jika ada): [hal yang perlu diperhatikan]
Gate yang Sudah Dijalankan: [A] [B] [C] [D] [E] [F] [G] [H]  (hanya yang benar-benar dijalankan)
```

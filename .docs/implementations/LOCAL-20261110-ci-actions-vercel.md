# LOCAL-20261110-ci-actions-vercel — Implementasi

**Branch:** chore/ci-actions-vercel  **Tanggal:** 2026-11-10  **PR:** (diisi setelah dibuka)

## Ringkasan
Menambah CI GitHub Actions (lint, typecheck, format check, test, build, npm audit, secret scan gitleaks, e2e Playwright), Dependabot mingguan (npm + github-actions, menargetkan `development`), panduan `.docs/DEPLOY.md` untuk Vercel dan pengaturan GitHub yang dikerjakan user, serta pembaruan CLAUDE.md §7 yang sudah usang.

## File yang Berubah
- `.github/workflows/ci.yml`: lima job paralel; `permissions: contents: read`; semua action di-pin ke commit SHA; tanpa `pull_request_target`; `persist-credentials: false`.
- `.github/dependabot.yml`: npm dan github-actions, mingguan, minor+patch dikelompokkan.
- `.docs/DEPLOY.md`: langkah Vercel, env per lingkungan, branch protection (nama check persis), secret scanning, default branch.
- `CLAUDE.md` §7: status proyek dan tugas user diperbarui.
- `.docs/tickets/LOCAL-20261110-ci-actions-vercel.md`, dokumen ini.

## Keputusan Desain
- Node 24 di CI (sama dengan mesin lokal; `engines` mengizinkan ≥ 22.12).
- Build/e2e memakai `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (nilai publik palsu); tanpa rahasia di CI.
- `npm audit --audit-level=high` gagal untuk High/Critical sesuai RULES_SECURITY §12.3.
- Gitleaks lewat `gitleaks-action`: gratis untuk repo akun pribadi; bila repo dipindah ke organisasi, butuh lisensi (catatan untuk user).
- Dependabot menargetkan `development`, sesuai alur PR.

## Dampak Keamanan
Rantai pasok: action di-pin SHA, izin minimal, tanpa dependensi runtime baru. Tidak menyentuh auth/input/data/upload. Checklist §13: tidak ada rahasia di diff; dependensi tidak bertambah.

## Verifikasi
- `npm run lint` → lulus
- `npm run typecheck` → lulus
- `npm run format:check` → lulus pada konten repo (LF); lokal Windows menampilkan peringatan karena `core.autocrlf=true`, terkonfirmasi lewat `prettier --check --end-of-line crlf` → lulus
- `npm run test` → 147/147 lulus di PowerShell. Di Git Bash gagal (`Cannot read properties of undefined (reading 'config')`), juga pada `development` bersih: masalah casing path Windows lokal, bukan perubahan ini
- `npm run build` → lulus dengan `NEXT_PUBLIC_SITE_URL` diset (tanpa variabel itu gagal, sesuai desain env)
- `npm audit --omit=dev --audit-level=high` → 0 kerentanan
- `npm run test:e2e` → tidak dijalankan lokal; dijalankan oleh job `e2e` di CI
- Isi workflow tidak bisa diuji lokal; validasi sebenarnya = run CI pada PR ini

## Open Question
- Pengaturan di `.docs/DEPLOY.md` (branch protection, default branch, secret scanning, Vercel) belum dilakukan; itu tugas user. Nama check untuk branch protection baru muncul setelah CI berjalan sekali.

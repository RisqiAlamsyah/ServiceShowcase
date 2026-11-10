# LOCAL-20261110-ci-actions-vercel — CI GitHub Actions, Dependabot, dan panduan Vercel

> **Area:** Infra/CI, Dokumentasi
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Status:** Done
> **Implementasi:** [LOCAL-20261110-ci-actions-vercel](../implementations/LOCAL-20261110-ci-actions-vercel.md)
> **Branch:** chore/ci-actions-vercel
> **Dampak keamanan:** Dependensi, rantai pasok (GitHub Actions), pengaturan repo (panduan untuk user)

## Deskripsi
Menutup pengaman yang belum ada (CLAUDE.md §7): setiap PR otomatis diuji, dependensi dipantau, dan ada panduan langkah Vercel + pengaturan GitHub yang dikerjakan user.

- Workflow CI: `lint`, `typecheck`, `format:check`, `test`, `build`, `npm audit --omit=dev` (High/Critical gagal), secret scan (gitleaks), dan e2e Playwright.
- Dependabot: npm dan github-actions, mingguan.
- Panduan `.docs/DEPLOY.md`: Import Project Vercel, env per lingkungan, branch protection `main` + `development`, default branch, secret scanning + push protection.
- Memperbarui CLAUDE.md §7 yang sudah usang.

**Tidak termasuk:** mengubah pengaturan repo/Vercel (tugas user), Prisma/DB, dependensi runtime baru.

## Scope Teknis
| Lapisan | File |
|---|---|
| CI | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| Dokumentasi | `.docs/DEPLOY.md`, `CLAUDE.md` §7 |

## Acceptance Criteria
- [x] `ci.yml` jalan pada PR ke `development`/`main` dan push ke keduanya; `permissions: contents: read`; action di-pin ke commit SHA; tanpa `pull_request_target`
- [x] Job: lint, typecheck, format:check, test, build, audit, secret scan, e2e
- [x] `dependabot.yml` untuk npm dan github-actions (mingguan)
- [x] `.docs/DEPLOY.md` memuat langkah Vercel, daftar nama check untuk branch protection, dan pengaturan keamanan GitHub
- [x] CLAUDE.md §7 diperbarui sesuai kondisi sebenarnya

## Verifikasi
- [x] `npm run lint` dan `npm run typecheck` lulus
- [x] `npm run test` lulus
- [x] `npm run build` lulus
- [x] `npm audit --omit=dev` tanpa High/Critical
- [ ] CI hijau pada PR ini (dicek setelah PR dibuka)

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff
- [x] Action pihak ketiga di-pin ke SHA; `permissions` minimal
- [x] Dependensi: tidak ada tambahan

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan (diff diperiksa)

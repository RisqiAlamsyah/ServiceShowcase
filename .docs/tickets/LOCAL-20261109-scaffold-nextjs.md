# LOCAL-20261109-scaffold-nextjs — Scaffold fondasi aplikasi (Next.js + Tailwind + tooling)

> **Area:** Infra / UI dasar
> **Tanggal dibuat:** 2026-11-09
> **Tanggal mulai:** 2026-11-09
> **Tanggal selesai:** 2026-11-09
> **Status:** Done
> **Implementasi:** [LOCAL-20261109-scaffold-nextjs](../implementations/LOCAL-20261109-scaffold-nextjs.md)
> **Branch:** feature/scaffold-nextjs
> **Dampak keamanan:** Header/CSP, env, dependensi

## Deskripsi
Fitur 0 dari SRS ServiceShowcase: fondasi proyek agar fitur berikutnya bisa dikerjakan satu per satu. Next.js (App Router, versi stabil terbaru; user menyebut "14+"), TypeScript strict, Tailwind, ESLint + Prettier, Vitest, Playwright, `src/lib/env.ts` tervalidasi, header keamanan + CSP dasar, dan tema visual dari SRS §8 (palet off-white/terracotta/charcoal, font serif editorial + sans bersih) pada halaman beranda placeholder.

**Tidak termasuk:** Prisma/DB, Auth.js, R2, semua modul MOD-01..06, GitHub Actions CI (tiket tersendiri).

## Scope Teknis
| Lapisan | File |
|---|---|
| Config | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `postcss.config.mjs`, `vitest.config.mts`, `playwright.config.ts` |
| Env | `src/lib/env.schema.ts`, `src/lib/env.ts`, `src/lib/env.client.ts`, `.env.example` |
| Keamanan | header statis di `next.config.ts`, CSP ber-nonce di `src/proxy.ts` |
| UI | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` |
| Tes | `tests/env.test.ts`, `e2e/home.spec.ts` |
| Dok | `.docs/SRS.md`, `README.md`, penyesuaian `RULES*.md` untuk Next 16 |

## Acceptance Criteria
- [x] Beranda placeholder dengan tema SRS §8 (diuji via E2E dan build; `npm run dev` tidak dijalankan interaktif)
- [x] TypeScript strict (`noUncheckedIndexedAccess`), tanpa `any` (ESLint `no-explicit-any: error`)
- [x] Skrip `lint`, `typecheck`, `test`, `test:e2e`, `build` ada dan lulus
- [x] `src/lib/env.schema.ts` memvalidasi env dengan Zod; pesan error hanya menyebut nama variabel
- [ ] `.env.example` berisi nama variabel + nilai palsu — **BELUM**: penulisan ditolak oleh aturan deny `.env.*` di `.claude/settings.json` (terlalu lebar), dan perubahan aturan itu ditolak classifier (self-modification). Menunggu keputusan user (lihat dokumen implementasi).
- [x] Respons memuat HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, X-Frame-Options, CSP ber-nonce; `X-Powered-By` hilang
- [x] Tes: unit env (berhasil + gagal) dan E2E beranda + header + nonce unik + tanpa pelanggaran CSP + 404 generik

## Verifikasi
- [x] `npm run lint`, `npm run typecheck`, `npm run test` (6 lulus), `npm run build`, `npm run test:e2e` (10 lulus: desktop + mobile)
- [x] `npm audit --omit=dev`: 0 kerentanan

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff
- [x] Header/CSP aktif, tidak dilonggarkan (tanpa `unsafe-eval` di production)
- [x] Dependensi baru dicatat di dokumen implementasi beserta alasannya
- [ ] `.env.example` hanya nama variabel (menunggu berkas dibuat)

## Definition of Done
- [ ] Semua AC terpenuhi (kecuali `.env.example`, lihat atas)
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan

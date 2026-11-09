# LOCAL-20261109-scaffold-nextjs — Implementasi

**Branch:** feature/scaffold-nextjs  **Tanggal:** 2026-11-09

## Ringkasan
Fondasi aplikasi: Next.js 16.4.5 (App Router), React 19.3, TypeScript 6.0 strict, Tailwind CSS 4, ESLint 9 + Prettier, Vitest 5, Playwright. Env tervalidasi Zod, header keamanan statis di `next.config.ts`, CSP ber-nonce per request di `src/proxy.ts`, dan beranda placeholder bertema SRS §8 (font Playfair Display + Plus Jakarta Sans lewat `next/font`, token warna/radius di CSS theme).

## File yang Berubah
- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `postcss.config.mjs`, `vitest.config.mts`, `playwright.config.ts`
- `src/lib/env.schema.ts` (skema + parser murni), `env.ts` (server-only), `env.client.ts` (publik)
- `src/proxy.ts`: CSP ber-nonce, matcher sesuai dokumentasi Next
- `src/app/{layout,page}.tsx`, `src/app/globals.css`
- `tests/env.test.ts`, `e2e/home.spec.ts`
- `.docs/SRS.md` (baru), `README.md`; penyesuaian `RULES.md`, `RULES_SECURITY.md`, `RULES_TEMPLATES.md`, `TICKET.md`, `CLAUDE.md`, `.code-reviewer/reviewer_local.md`, `.claude/hooks/gate-ticket.js` untuk Next 16 (`proxy.ts`, `params` berupa `Promise`)

## Dependensi baru (disetujui lewat daftar stack dan aturan; dicatat sesuai RULES §7)
| Paket | Alasan |
|---|---|
| `next`, `react`, `react-dom` | Framework (stack pilihan user) |
| `zod` | Validasi env dan input (RULES_SECURITY §4) |
| `server-only` | Gagalkan build bila modul rahasia terimpor klien |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` | Styling (stack) |
| `typescript`, `@types/*` | TypeScript strict |
| `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss` | Lint/format (RULES §7) |
| `vitest`, `vite` | Unit test (`vite` adalah peer dependency Vitest) |
| `@playwright/test` | E2E |

Semua versi dikunci lewat `package-lock.json`.

## Keputusan Desain
- **Versi:** user menulis "Next.js 14+"; dipakai versi stabil terbaru (16.4.5) karena patch keamanan, dan Next 14 sudah berada jauh di belakang. Next 16 mengganti `middleware.ts` menjadi `proxy.ts` dan `params` berupa `Promise`; aturan dan template disesuaikan setelah membaca dokumentasi yang dibawa paket (`node_modules/next/dist/docs`).
- **TypeScript 6.0, bukan 7:** `typescript-eslint` mendukung `<6.1.0`, sehingga TS 7 merusak lint. **ESLint 9, bukan 10:** `eslint-plugin-react` baru mendukung sampai `^9.7`. Naikkan keduanya saat ekosistem siap.
- **`vitest.config.mts`** (bukan `.ts`) dan tanpa `"type": "module"`, supaya hook `.claude/hooks/*.js` tetap CommonJS.
- **Kontras warna:** terracotta `#C86D51` di atas canvas hanya ±3,4:1 (di bawah AA untuk teks kecil), jadi dipakai untuk elemen besar/ornamen; teks kecil beraksen memakai `--color-accent-strong` `#A5502F` (±5:1). Tombol utama memakai charcoal, sesuai SRS.
- ESLint dikecualikan untuk `.claude/**` dan `.code-reviewer/**` (skrip Node, bukan kode aplikasi). Aturan tambahan: `no-explicit-any`, `no-eval`, `react/no-danger`, `no-console` (warn).

## Dampak Keamanan
- Header: HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, X-Frame-Options; `X-Powered-By` dimatikan; source map produksi mati.
- CSP ber-nonce tanpa `unsafe-eval` di production (hanya dev), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action` `'self'`.
- Konsekuensi: beranda dirender dinamis (tidak di-cache CDN). Lihat Open Question.
- Env: pesan error validasi hanya memuat nama variabel, tidak nilainya (diuji).

## Verifikasi
| Perintah | Hasil |
|---|---|
| `npm run typecheck` | lulus |
| `npm run lint` | lulus (0 masalah) |
| `npm run test` | lulus, 6 tes |
| `npm run build` (dengan `NEXT_PUBLIC_SITE_URL`) | lulus; `/` dinamis, `Proxy` terdeteksi |
| `npm run test:e2e` | lulus, 10 tes (desktop + mobile Pixel 7), termasuk nonce unik dan tanpa pelanggaran CSP |
| `npm audit --omit=dev` | 0 kerentanan |
| `npm audit` (semua) | 8 moderate, semuanya di tooling dev (rantai `minimatch`); tidak ikut ke produksi |
| `npm run dev` interaktif, tampilan visual di browser | **tidak dijalankan/diperiksa secara visual**; hanya diuji lewat E2E dan build |
| Kontras dan tampilan di 360 px | belum diuji visual |

## Open Question
1. **`.env.example` belum ada.** Aturan `Read(./.env.*)` di `.claude/settings.json` ikut memblokir penulisan `.env.example`. Perubahan aturan itu ditolak classifier karena menyentuh izin Claude sendiri. Pilihan user: (a) persempit deny menjadi nama berkas rahasia eksplisit (`.env`, `.env.local`, `.env.production`, dst.), atau (b) buat `.env.example` sendiri dengan isi `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. README dan `playwright.config.ts` tidak bergantung padanya, tetapi `npm run build` lokal butuh variabel itu.
2. **CSP ber-nonce vs kecepatan halaman publik** (target SRS < 1,5 dtk). Putuskan saat fitur halaman publik dikerjakan (`.docs/SRS.md` §5).
3. Pengaturan GitHub (branch protection, Actions CI, Dependabot) masih tugas user / tiket tersendiri.

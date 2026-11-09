# ServiceShowcase

Micro-SaaS pembuat halaman portofolio, daftar harga, dan kalkulator estimasi untuk MUA, fotografer, dan videografer. Spesifikasi: `.docs/SRS.md`. Aturan kerja: `CLAUDE.md` dan `.docs/RULES*.md`.

Stack: Next.js (App Router) · TypeScript strict · Tailwind CSS v4 · PostgreSQL + Prisma · Auth.js · Cloudflare R2.

## Menjalankan

```bash
cp .env.example .env.local     # isi nilainya; jangan di-commit
npm ci
npm run dev                    # http://localhost:3000
```

| Perintah | Fungsi |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run test` | Vitest (unit/integrasi) |
| `npm run test:e2e` | Playwright terhadap build produksi (`npx playwright install chromium` sekali) |
| `npm run build` | Build produksi (butuh `NEXT_PUBLIC_SITE_URL`) |

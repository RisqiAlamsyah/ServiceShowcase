# LOCAL-20261109-setup-claude-rules — Implementasi

**Branch:** chore/setup-claude-rules  **Tanggal:** 2026-11-09

## Ringkasan
Aturan proyek ditulis ulang dari Telin (CodeIgniter 3, PHP, Phinx, OpenProject, Bitbucket/GitLab) ke stack Next.js (App Router), Tailwind, Server Actions/Route Handlers, Prisma + PostgreSQL (Supabase/Neon), Auth.js, dan Cloudflare R2. Keamanan diperketat lewat `RULES_SECURITY.md` dan hook yang menolak pola berbahaya. Alur: tiket lokal, PR ke `development`, lalu PR rilis ke `main`; Claude boleh commit/push branch kerja, merge oleh user.

## File yang Berubah
- `CLAUDE.md`, `.docs/RULES.md`, `RULES_SECURITY.md` (baru), `RULES_TEMPLATES.md`, `RULES_FRONTEND.md`, `RULES_DB.md`, `TICKET.md`
- `.claude/settings.json` (hook + deny baca `.env*`), `.claude/hooks/{guard-git,guard-code,gate-ticket,lint-ts,check-env}.js`
- `.code-reviewer/{config.json,reviewer_local.md,reviewer_local.py}`: base `development`, API key lewat header
- `.gitignore` (baru)
- Dihapus (tidak pernah di git): tiket/implementasi Telin, `MIGRASI_DB.md`, `bitbucket_mcp.py`, `lint-php.js`, `settings.local.json`

## Keputusan Desain
- Hook di `settings.json` (ikut commit), bukan `settings.local.json`.
- Pengecualian satu baris pada `guard-code` hanya dengan `// sec-ok: <alasan>`.
- `development` diproteksi oleh hook sama seperti `main`.
- Atribusi AI tetap dilarang (aturan lama user dipertahankan).

## Dampak Keamanan
Menambah penegakan: rahasia, XSS, SQL injection, CORS/ACL longgar, git/gh/prisma destruktif.

## Verifikasi
`node --check` semua hook lulus; 33 kasus simulasi lulus. Belum diuji: scan rahasia pada commit di branch kerja, `lint-ts.js`, `gate-ticket.js` end-to-end.

## Open Question
- Branch protection `development`/`main`, Actions CI, Dependabot, secret scanning: diaktifkan user di GitHub.
- `gh` belum terpasang (diperlukan untuk membuka PR dari CLI).

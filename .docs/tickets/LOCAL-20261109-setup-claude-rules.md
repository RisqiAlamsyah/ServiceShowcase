# LOCAL-20261109-setup-claude-rules — Aturan Claude untuk stack Next.js + keamanan ketat

> **Area:** Dokumentasi / Infra (konfigurasi Claude Code)
> **Tanggal dibuat:** 2026-11-09
> **Tanggal mulai:** 2026-11-09
> **Tanggal selesai:** 2026-11-09
> **Status:** Done
> **Branch:** chore/setup-claude-rules
> **Dampak keamanan:** Header/CSP, rahasia, otorisasi, upload, dependensi (aturan dan hook penegak)
> **Implementasi:** [LOCAL-20261109-setup-claude-rules](../implementations/LOCAL-20261109-setup-claude-rules.md)

## Deskripsi
Mengganti aturan Telin (CodeIgniter/PHP) dengan aturan untuk Next.js 14+ + Tailwind + Prisma + Auth.js + Cloudflare R2, dengan keamanan diperketat dan hook penegak. Alur git: `feature/*` → `development` → `main`. Tidak termasuk: scaffold aplikasi, GitHub Actions, pengaturan repo GitHub.

## Acceptance Criteria
- [x] CLAUDE.md dan `.docs/RULES*.md`, `TICKET.md` sesuai stack baru
- [x] `RULES_SECURITY.md` dengan checklist per PR
- [x] Hook: guard-git, guard-code, gate-ticket, lint-ts, check-env; terdaftar di `.claude/settings.json`
- [x] `.gitignore` mencegah rahasia ter-commit
- [x] File Telin dihapus; code-reviewer diselaraskan (base `development`)
- [x] Branch `development` dibuat dari `main`

## Verifikasi
- [x] `node --check` semua hook lulus
- [x] 33 kasus simulasi hook lulus (skrip di scratchpad sesi, bukan bagian repo)
- [ ] Belum diuji: commit di branch kerja dengan scan rahasia pada diff staged, `lint-ts.js` (belum ada ESLint), `gate-ticket.js` end-to-end

## Definition of Done
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan

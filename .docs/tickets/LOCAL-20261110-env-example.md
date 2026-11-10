# LOCAL-20261110-env-example — Perbarui .env.example (DB dan AUTH_SECRET)

> **Area:** Dokumentasi
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Status:** Done
> **Branch:** chore/env-example
> **Dampak keamanan:** Tidak ada (hanya nama variabel dan nilai palsu/kosong)

## Deskripsi
Mencatat variabel lingkungan baru di `.env.example`: `DATABASE_URL`, `DIRECT_URL` (tiket Prisma), dan `AUTH_SECRET` (tiket Auth). Isi diedit oleh user karena Claude tidak boleh membaca atau menulis berkas itu; Claude hanya men-stage dan meng-commit.

## Acceptance Criteria
- [x] `.env.example` memuat nama `DATABASE_URL`, `DIRECT_URL`, dan `AUTH_SECRET`
- [x] Tidak ada nilai asli: hanya nilai palsu atau kosong (dipindai hook pada diff staged)

## Catatan
Tidak ada dokumen implementasi terpisah (tiket ringan, `.docs/TICKET.md` §3). Isi berkas tidak diperiksa oleh Claude; pemindaian hanya oleh hook `guard-git.js`.

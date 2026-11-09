# TICKET.md — Panduan Penulisan Tiket dan Dokumen Implementasi

> Satu jalur: **tiket lokal**. Alur gate ada di `CLAUDE.md` §2. Aturan teknis di `RULES*.md`.

---

## 1. Penamaan dan lokasi

| Item | Nilai |
|---|---|
| File tiket | `.docs/tickets/LOCAL-YYYYMMDD-{slug}.md` |
| Branch kerja | `{type}/{slug}` (mis. `feature/login-google`) |
| Dokumen implementasi | `.docs/implementations/LOCAL-YYYYMMDD-{slug}.md` |

- `{slug}`: huruf kecil, angka, dan tanda hubung; **harus sama persis** dengan bagian nama branch setelah `/` (hook mencocokkan tiket lewat nama branch).
- `{type}`: `feature`, `fix`, `chore`, `security`, `docs`.
- Bahasa: deskripsi dan AC dalam bahasa Indonesia; nama file, class, route, tabel, dan method dalam bahasa Inggris.
- Jangan menaruh rahasia, data pribadi nyata, atau connection string di tiket maupun dokumen implementasi.

---

## 2. Format tiket

```markdown
# LOCAL-YYYYMMDD-{slug} — {Judul singkat}

> **Area:** {UI | Server Action/API | Auth | DB | Storage (R2) | Infra/CI | Dokumentasi}
> **Tanggal dibuat:** YYYY-MM-DD
> **Status:** Backlog
> **Branch:** {type}/{slug}
> **Dampak keamanan:** {Tidak ada | Auth | Otorisasi | Input | Upload | Data pribadi | Dependensi | Header/CSP}

## Deskripsi
Tujuan, siapa pengguna, dan batasan (apa yang TIDAK termasuk).

## Scope Teknis
| Lapisan | File |
|---|---|
| Halaman/Komponen | `src/app/...`, `src/components/...` |
| Action/Route | `src/actions/...`, `src/app/api/...` |
| Service/Data | `src/server/...` |
| Validasi | `src/lib/validation/...` |
| DB | `prisma/schema.prisma` + migrasi (jika ada) |
| Tes | `tests/...`, `e2e/...` |

## Acceptance Criteria
- [ ] ...

## Verifikasi
- [ ] `npm run lint` dan `npm run typecheck` lulus
- [ ] `npm run test` lulus: jalur berhasil, input tidak valid, akses ditolak (+ IDOR bila menyentuh data pengguna)
- [ ] `npm run test:e2e` skenario {nama} lulus (bila menyentuh alur UI)
- [ ] `npm run build` lulus (bila menyentuh config/middleware/route/env)
- [ ] Migrasi diuji dari DB kosong dan DB berisi data contoh di database lokal sementara (bila ada perubahan skema)
- [ ] `npm audit --omit=dev` tanpa High/Critical (bila dependensi berubah)

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [ ] (salin item yang relevan)

## Definition of Done
- [ ] Semua AC terpenuhi
- [ ] Dokumen implementasi dibuat
- [ ] Tidak ada rahasia di perubahan (diff diperiksa)
```

Field yang ditambahkan saat workflow berjalan:
- Mulai: `**Tanggal mulai:** YYYY-MM-DD` dan `Status: In Progress`.
- Selesai: `**Tanggal selesai:** YYYY-MM-DD`, `Status: Done`, dan `**Implementasi:** [{ID}](../implementations/{ID}.md)`.
- Perbaikan setelah Done: tambah baris `**Tanggal mulai perbaikan:** YYYY-MM-DD`.
- Setelah PR dibuka: `**PR:** <URL>`.

Status valid: `Backlog`, `In Progress`, `Done`. Hook `gate-ticket.js` hanya mengizinkan edit kode saat status `In Progress`.

---

## 3. Tiket ringan

Untuk chore kecil boleh format ringkas: Header, Deskripsi, Acceptance Criteria, Catatan, tetapi baris **Dampak keamanan** dan Status tetap ada.

---

## 4. Dokumen implementasi

Dibuat di Gate [F], sebelum menyatakan pekerjaan selesai: `.docs/implementations/{ID}.md`.

```markdown
# {ID} — Implementasi

**Branch:** {branch}  **Tanggal:** YYYY-MM-DD  **PR:** {URL bila ada}

## Ringkasan
1-2 paragraf: apa yang dibangun atau diubah.

## File yang Berubah
- `path/file.ts`: deskripsi singkat

## Keputusan Desain
Terutama yang non-obvious atau berbeda dari asumsi tiket.

## Dampak Keamanan
Auth/otorisasi/input/upload/data yang tersentuh; checklist `RULES_SECURITY.md` §13 yang relevan, dan yang sengaja tidak dipenuhi beserta alasannya.

## Verifikasi
Perintah/skenario yang dijalankan dan hasilnya apa adanya (lulus/gagal/dilewati).

## Open Question
Hal yang masih perlu konfirmasi user. Tulis eksplisit; jangan disembunyikan.
```

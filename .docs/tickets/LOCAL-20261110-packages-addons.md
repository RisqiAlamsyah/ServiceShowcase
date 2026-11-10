# LOCAL-20261110-packages-addons — Paket dan add-on (CRUD) dengan batas tier

> **Area:** UI, Server Action/API, DB
> **Tanggal dibuat:** 2026-11-10
> **Tanggal mulai:** 2026-11-10
> **Tanggal selesai:** 2026-11-10
> **Status:** Done
> **Implementasi:** [LOCAL-20261110-packages-addons](../implementations/LOCAL-20261110-packages-addons.md)
> **Branch:** feature/packages-addons
> **Dampak keamanan:** Otorisasi (kepemilikan data, IDOR), Input, Rate limit, Gating tier (mass assignment `plan`)

## Deskripsi
MOD-04 (SRS §2, §3): vendor mengelola paket jasa dan add-on-nya. Batas tier ditegakkan **di server**, bukan hanya UI.

Keputusan user (10 Nov 2026): bila vendor turun dari Pro ke Free, paket di luar batas **disembunyikan dari halaman publik, tidak dihapus**.

Aturan tier:
- **Free:** maksimal **2 paket**, **tanpa add-on** (SRS §2).
- **Pro:** tanpa batas praktis; ada batas pengaman anti-penyalahgunaan: 50 paket per akun dan 20 add-on per paket (selaras `MAX_ADDONS` kalkulator).
- Batas jumlah paket menghitung **semua** paket milik vendor (termasuk yang disembunyikan); vendor yang sudah melewati batas tetap bisa mengubah dan menghapus, tetapi tidak bisa menambah.
- **Keterlihatan publik dihitung saat dibaca, tanpa kolom baru:** paket terlihat = N pertama menurut `position`, lalu `createdAt`, lalu `id` (N = batas tier); add-on terlihat hanya bila Pro. Fungsi murni ini dipakai dashboard sekarang dan halaman publik (tiket 7) nanti. Naik kembali ke Pro otomatis menampilkan semuanya lagi.
- Batas dicek di dalam transaksi dengan kunci advisory per pengguna, agar dua permintaan bersamaan tidak melewati batas.
- Cara menjadi Pro belum ada (open question SRS); `plan` tidak pernah dari input pengguna.

Harga: bilangan bulat rupiah 0–`MAX_RUPIAH`. Input menerima digit, titik pemisah ribuan, spasi, dan awalan "Rp"; bentuk lain (mis. `1e6`, desimal, negatif) ditolak.

Halaman: `/dashboard/paket` (daftar + tambah paket) dan `/dashboard/paket/[id]` (ubah paket, hapus, kelola add-on). Hapus selalu lewat konfirmasi dua langkah.

**Tidak termasuk:** halaman publik (tiket 7), pengurutan ulang lewat seret (urutan mengikuti pembuatan), cara upgrade ke Pro/billing, foto portofolio, migrasi DB (model `ServicePackage` dan `Addon` sudah ada).

## Scope Teknis
| Lapisan | File |
|---|---|
| Kebijakan tier | `src/lib/plans.ts` |
| Halaman/Komponen | `src/app/(app)/dashboard/paket/page.tsx`, `src/app/(app)/dashboard/paket/[id]/page.tsx`, `src/components/package/*`, `src/components/ui/*` |
| Action | `src/actions/package.ts` |
| Service | `src/server/package/service.ts` |
| Validasi | `src/lib/validation/package.ts`, `src/lib/money.ts` (parser input rupiah) |
| Rate limit | `src/server/auth/rate-limit.ts` |
| Tes | `tests/package-*.test.ts`, `tests/plans.test.ts`, `e2e/package.spec.ts`, `e2e/package-flow.spec.ts` (butuh DB, dilewati di CI) |

## Acceptance Criteria
- [x] Pengguna yang login dapat membuat, mengubah, dan menghapus paket dan add-on miliknya; `ownerId` selalu dari sesi
- [x] Pengguna A tidak bisa membaca, mengubah, atau menghapus paket/add-on pengguna B, dan tidak bisa menaruh add-on di paket B (IDOR)
- [x] Free: paket ke-3 ditolak di server; add-on ditolak di server dengan pesan "tersedia di Pro"
- [x] Batas jumlah paket tidak bisa dilewati dengan permintaan bersamaan (transaksi + kunci advisory)
- [x] Paket di luar batas tier tidak terhitung terlihat publik (fungsi murni teruji) dan ditandai "Disembunyikan" di dashboard; tidak ada yang dihapus
- [x] Harga divalidasi (bilangan bulat rupiah dalam rentang); format tidak valid ditolak per kolom
- [x] Hapus butuh konfirmasi dua langkah; hapus paket ikut menghapus add-on-nya (cascade)
- [x] `/dashboard/paket` dan `/dashboard/paket/[id]` tanpa sesi diarahkan ke `/masuk`; id paket asing atau bukan milik pengguna menghasilkan 404
- [x] Form mempertahankan isian saat gagal dan memindahkan fokus ke galat pertama

## Verifikasi
- [x] `npm run lint` dan `npm run typecheck` lulus
- [x] `npm run test` lulus: berhasil, input tidak valid, akses ditolak, IDOR, batas tier
- [x] `npm run test:e2e` lulus (tanpa DB); alur penuh `E2E_WITH_DB=1` lulus terhadap Neon dev
- [x] `npm run build` lulus
- [x] `npm audit --omit=dev` tanpa High/Critical

## Checklist Keamanan (`RULES_SECURITY.md` §13)
- [x] Tidak ada rahasia di diff
- [x] Input divalidasi Zod di server (`.strict()`, batas panjang, `cuid` untuk id)
- [x] Setiap action: otentikasi + otorisasi + kepemilikan di query
- [x] Tes: berhasil, tidak valid, akses ditolak, IDOR
- [x] Endpoint tulis berlimit laju
- [x] Tidak ada data sensitif ke log; pesan error generik; 404 (bukan 403) untuk milik orang lain

## Definition of Done
- [x] Semua AC terpenuhi
- [x] Dokumen implementasi dibuat
- [x] Tidak ada rahasia di perubahan (diff diperiksa)

# SRS.md — Ringkasan Spesifikasi ServiceShowcase (v1.1.0)

> Ringkasan dari `documentation2.html` (SRS/BRD/PRD/FRD/FRS/ERD milik user). Dokumen ini acuan kebutuhan; **aturan teknis dan keamanan tetap di `RULES*.md`**. Bila SRS dan RULES berbeda, lihat §3 (keputusan penyesuaian).

## 1. Produk
Micro-SaaS pembuat halaman portofolio interaktif untuk pekerja kreatif jasa (MUA, fotografer, videografer). Vendor mendaftar, mengisi profil, portofolio, dan paket; calon klien membuka `domain.com/{slug}`, memilih paket dan add-on, melihat total estimasi real-time, lalu memesan lewat tautan WhatsApp (`wa.me`). Calon klien **tidak perlu login**.

Target: halaman publik < 1,5 dtk di 4G; CTR tombol WA ≥ 12%; 500 pengguna aktif dalam 3 bulan. Mobile-first (90%+ seluler).

## 2. Modul (FRD)
| ID | Modul | Isi | Prioritas |
|---|---|---|---|
| MOD-01 | Authentication | Daftar/login Email+Password dan Google SSO | Must |
| MOD-02 | Profile & Link | Identitas bisnis, WhatsApp, bio, slug unik | Must |
| MOD-03 | Portfolio | Unggah foto, kategori, kompresi gambar | Must |
| MOD-04 | Package & Addon CRUD | Paket (nama, deskripsi, harga dasar) + add-on | Must |
| MOD-05 | Public Price Calculator | Pilih paket (radio) + add-on (checkbox), total real-time | Must |
| MOD-06 | WhatsApp Redirection | Susun pesan (nama, tanggal, paket, add-on, total) menjadi URL `wa.me` | Must |

Di luar V1: payment gateway di halaman publik, custom domain, kalender booking kompleks, aplikasi mobile native.

**Format pesan WA (FRS 4.1):** `Halo kak!` / `Saya mau booking jasa untuk:` / Nama / Tanggal (dd/mm/yyyy) / Paket (Rp) / Add-on (daftar) / `Total Estimasi: Rp ...` / `Apakah slot tersedia?`, di-encode dengan `encodeURIComponent`.

**Tier:** Free: 3 foto, 2 paket, watermark "Powered by ServiceShowcase", kalkulator dasar tanpa add-on. Pro (Rp 29–49 rb/bln): tanpa batas, tanpa watermark, kalkulator penuh + add-on.

**UI (SRS §8):** canvas `#FAFAFA`/`#F9F6F0`, aksen terracotta `#C86D51`, charcoal `#1E1E1E`; heading serif (Playfair Display), body sans (Plus Jakarta Sans); radius 4–8 px, tanpa shadow tebal; galeri masonry. Sudah diterapkan sebagai token di `src/app/globals.css`.

## 3. Keputusan penyesuaian terhadap aturan keamanan
Diterapkan secara default karena `RULES_SECURITY.md` menang. Beri tahu bila ingin berbeda.

| Topik | Di SRS | Diterapkan | Alasan |
|---|---|---|---|
| Hash password | bcrypt, salt 10 | **Argon2id** (atau bcrypt cost ≥ 12) | Parameter lebih kuat; RULES_SECURITY §2.7 |
| ID tabel | `SERIAL` integer | **`cuid`/`uuid`** string | ID berurutan mudah ditebak (enumerasi/IDOR) pada resource yang terekspos di URL |
| Kompresi gambar | di browser (WebP 1080 px, 80%) | Browser hanya untuk UX/penghematan bandwidth; **server tetap memverifikasi** tipe, ukuran, magic bytes dan memproses ulang (sharp, buang EXIF) | Klien tidak tepercaya; RULES_SECURITY §9 |
| Sesi | JWT (NextAuth) | JWT berumur pendek (Credentials memaksa JWT) + role/status dibaca ulang dari DB pada aksi sensitif | RULES_SECURITY §2.2 |
| Harga di kalkulator | dihitung di frontend | Harga **selalu dari DB (server)**; total di klien hanya tampilan; pesan WA memakai data dari server + input pengguna yang divalidasi (nama ≤ 60, tanggal valid) | Cegah manipulasi harga/injeksi teks |
| `plan_type` | kolom `users` | Tidak pernah diisi dari input pengguna; hanya diubah proses terpercaya (admin/billing) | Mass assignment |
| Batas Free tier | 3 foto / 2 paket | Ditegakkan **di server** (service + transaksi), bukan hanya UI | Bypass lewat Server Action langsung |
| Slug | `domain.com/slug` | Regex `^[a-z0-9-]{3,30}$` + **daftar slug terlarang** (`admin`, `api`, `login`, `register`, `dashboard`, `_next`, dst.) | Tabrakan dengan rute aplikasi |
| Database | "PostgreSQL / MySQL" | **PostgreSQL saja** (Supabase/Neon + Prisma) | Konsistensi dengan RULES_DB |
| Nama kolom | `user_id` dll. | Model Prisma `userId` + `@map("user_id")`; tabel `@@map` snake_case jamak | RULES_DB §2 |
| CSP & performa | target < 1,5 dtk, SSR | CSP ber-nonce membuat halaman **dinamis** (tanpa cache CDN) | Lihat open question di bawah |

## 4. Usulan urutan fitur (satu tiket, satu PR per baris)
0. **Scaffold** (selesai di tiket `LOCAL-20261109-scaffold-nextjs`)
1. **Fondasi data**: Prisma + koneksi DB + model + migrasi awal + helper rate limit
2. **MOD-06 + MOD-05 (inti murni)**: fungsi pembentuk pesan WA dan penghitung total (tanpa DB, unit-test berat) + UI kalkulator dengan data contoh
3. **MOD-01** Auth (Email/Password dulu, lalu Google)
4. **MOD-02** Profil + slug
5. **MOD-04** Paket & add-on CRUD (+ batas Free tier)
6. **MOD-03** Portofolio + upload R2
7. **Halaman publik `/{slug}`**: merangkai data nyata, masonry, watermark, gating tier
8. **CI/CD GitHub Actions** + Dependabot (bisa dipercepat bila diinginkan)

## 5. Open question
- **Pro tier**: bagaimana vendor membayar langganan (gateway pembayaran untuk *billing platform* tidak termasuk "payment gateway halaman publik")? Untuk V1: ubah `plan` manual oleh admin?
- **Peran admin platform**: SRS menyebut route `/admin` (dashboard vendor). Apakah ada super-admin terpisah?
- **CSP ber-nonce vs kecepatan halaman publik**: pertahankan nonce (dinamis) atau gunakan CSP berbasis hash/`'self'` untuk halaman publik statis?
- **Klik tracking** untuk metrik CTR WA butuh endpoint pencatat (rawan abuse, perlu rate limit); masuk V1 atau ditunda?
- **Verifikasi email** pendaftaran dan layanan pengirim email (Resend/SMTP): diperlukan untuk reset sandi.

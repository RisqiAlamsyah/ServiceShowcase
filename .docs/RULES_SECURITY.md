# RULES_SECURITY.md — Aturan Keamanan ServiceShowcase

> Wajib dibaca di setiap pekerjaan (Gate [D]). Bila bertentangan dengan aturan lain, **dokumen ini menang**.
> Prinsip: *deny by default*, *validate at the boundary*, *least privilege*, *defense in depth* (satu lapis gagal, lapis lain menahan).
> Tanda **[hook]** = ditegakkan otomatis oleh hook di `.claude/hooks/`; sisanya ditegakkan lewat review dan tes.

---

## 1. Rahasia dan environment

1. Rahasia (DB URL, `AUTH_SECRET`, kunci R2, OAuth client secret, webhook secret) hanya di `.env.local` (dev) dan pengaturan env Vercel (preview/production, **terpisah per lingkungan**). Tidak pernah di kode, tes, fixture, log, issue, atau PR. **[hook]**
2. `.env*` di-`.gitignore` (kecuali `.env.example`). `.env.example` hanya nama variabel + nilai palsu (`postgresql://user:password@localhost:5432/db` aman; nilai nyata tidak). **[hook]**
3. **Satu pintu env**: `src/lib/env.ts` memvalidasi `process.env` dengan Zod saat start (gagal cepat bila hilang/salah format) dan dipisah `serverEnv` (rahasia, `import "server-only"`) vs `clientEnv` (hanya `NEXT_PUBLIC_*`). Tidak ada `process.env.X` tersebar di luar berkas ini.
4. `NEXT_PUBLIC_*` **ditanam ke bundel klien**: tidak boleh berisi rahasia, DB URL, atau kunci layanan. **[hook]**
5. Kunci berbeda untuk dev, preview, production. Kunci production tidak pernah dipakai di lokal atau CI.
6. **Bila rahasia bocor** (ter-commit, tercetak, terkirim): anggap sudah dicuri → **rotasi dulu**, baru bersihkan riwayat. Menghapus commit tidak cukup. Beri tahu user segera.
7. `AUTH_SECRET` ≥ 32 byte acak (`openssl rand -base64 32`), unik per lingkungan.

---

## 2. Otentikasi (Auth.js / NextAuth)

1. **Auth.js versi stabil terbaru yang kompatibel**; pembaruan keamanan diterapkan segera. Next.js juga selalu di patch terbaru (pernah ada bypass middleware, CVE-2025-29927; karena itu proxy/middleware **bukan** satu-satunya pagar, lihat §3).
2. Strategi sesi: **database session** (Prisma Adapter) bila memungkinkan, agar sesi bisa dicabut (logout semua perangkat, ban, ganti sandi). Provider Credentials memaksa JWT; bila dipakai, umur JWT pendek (≤ 15 menit–1 jam), dan data sensitif (role, status akun) **dibaca ulang dari DB** pada aksi sensitif, bukan dipercaya dari token.
3. Cookie sesi: `httpOnly`, `secure` (production), `sameSite: "lax"` (atau `strict` bila alur memungkinkan), nama berawalan `__Secure-`/`__Host-` di production (default Auth.js). Jangan menimpa ke `secure: false`. **[hook]**
4. **Account linking**: `allowDangerousEmailAccountLinking` **tidak boleh `true`** (pengambilalihan akun lewat email IdP yang tidak terverifikasi). **[hook]**
5. Provider OAuth: batasi `scope` minimum; verifikasi `email_verified` sebelum mempercayai email; callback URL terdaftar eksplisit di penyedia (tanpa wildcard).
6. **Open redirect**: callback `redirect` Auth.js dan parameter `callbackUrl`/`next` hanya menerima path relatif satu-origin (`/` diikuti bukan `/` atau `\`), atau origin dari daftar putih.
7. **Password (bila ada Credentials)**: hash **Argon2id** (`@node-rs/argon2`, parameter OWASP) atau bcrypt cost ≥ 12; **tidak** MD5/SHA-*. Panjang minimum 12, tanpa batas atas rendah (≥ 64), tolak sandi umum/bocor (daftar atau HIBP k-anonymity), tanpa aturan komposisi yang memaksa pola lemah. Bandingkan dengan fungsi verifikasi library (waktu konstan).
8. **Anti-enumerasi**: login, daftar, dan lupa sandi menjawab **sama** baik akun ada maupun tidak (pesan dan waktu respons mirip). Reset sandi: token acak ≥ 32 byte, **disimpan sebagai hash**, sekali pakai, kedaluwarsa ≤ 30 menit, semua sesi lama dicabut setelah ganti.
9. **Rate limit + lockout bertahap** di login, daftar, lupa sandi, verifikasi email/OTP (§7).
10. Ganti email/sandi, hapus akun, dan aksi admin meminta **otentikasi ulang** (sandi atau sesi segar).
11. Pesan error auth generik ("Email atau sandi salah"); alasan sebenarnya hanya di log server.

---

## 3. Otorisasi

> **Server Action = endpoint HTTP publik.** Siapa pun yang tahu ID-nya bisa memanggilnya langsung, tanpa melewati UI atau proxy.

1. **Setiap Server Action, Route Handler, dan fungsi service sensitif memanggil otorisasi di server sebagai langkah pertama**, sebelum membaca input lain:
   ```ts
   const user = await requireUser();            // lempar/ kembalikan UNAUTHENTICATED bila tidak login
   requireRole(user, ["ADMIN"]);                // bila aksi khusus peran
   ```
   Menyembunyikan tombol di UI **bukan** otorisasi.
2. **Cek kepemilikan resource di query** (cegah IDOR/BOLA). Jangan: `findUnique({ where: { id } })` lalu mengembalikan. Lakukan:
   ```ts
   prisma.project.findFirst({ where: { id, ownerId: user.id } })          // baca
   prisma.project.updateMany({ where: { id, ownerId: user.id }, data })   // ubah; cek count === 1
   ```
   Hasil kosong → `NOT_FOUND` (bukan `FORBIDDEN`, agar tidak membocorkan keberadaan).
3. **Mass assignment**: field yang boleh diubah ditentukan skema Zod `.strict()` per aksi; jangan `data: input` / `...formData` langsung. `role`, `ownerId`, `isAdmin`, `status`, `emailVerified` **tidak pernah** berasal dari input pengguna biasa.
4. Peran dan izin: model sederhana (`USER`, `ADMIN`, ...) di DB, dicek lewat satu helper (`src/server/auth/`). Tidak ada `if (email === "...")`.
5. **Proxy** (`src/proxy.ts` di Next 16; `middleware.ts` di Next ≤ 15) hanya lapis kasar (redirect ke login, blok awal). Pagar sebenarnya di layout `(app)` + tiap action/route. Matcher proxy harus mencakup `/api` dan rute baru; uji bahwa rute terlindungi menolak tanpa sesi.
6. Halaman admin: `requireRole` di layout **dan** di setiap action admin.
7. Setiap fitur baru yang menyentuh data pengguna wajib punya tes "akses ditolak" dan tes IDOR (`RULES.md` §6).

---

## 4. Input, output, dan injeksi

1. **Validasi Zod di server** untuk semua input: body Server Action, Route Handler (JSON/form), `searchParams`, `params`, header yang dipakai, dan payload webhook. Validasi klien hanya untuk UX. Batasi panjang/ukuran/jumlah (`max`), gunakan `.strict()`, `z.enum` untuk nilai terbatas, `z.string().uuid()`/`cuid()` untuk ID.
2. **SQL injection**: hanya Prisma Client atau tagged template (`` prisma.$queryRaw`... ${x}` ``, `Prisma.sql`). **Dilarang** `$queryRawUnsafe`/`$executeRawUnsafe` dan menyambung string SQL. Nama kolom/urutan dari pengguna dicocokkan ke daftar putih. **[hook]**
3. **XSS**: React meng-escape secara default; jangan membongkarnya. **Dilarang** `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, `new Function` dengan data tak tepercaya. **[hook]** Bila HTML pengguna memang diperlukan (mis. rich text): sanitasi di server dengan DOMPurify/`sanitize-html` (daftar putih tag/atribut), simpan hasilnya, beri komentar `// sec-ok: <alasan>`, dan minta persetujuan user.
4. **URL dari pengguna** (`href`, `src`, redirect): izinkan hanya skema `https:` (dan `mailto:` bila perlu); tolak `javascript:`/`data:`. Link eksternal `rel="noopener noreferrer"`.
5. **SSRF**: server tidak melakukan `fetch` ke URL yang dikendalikan pengguna. Bila terpaksa (mis. impor gambar dari URL): daftar putih host, hanya `https`, tolak IP privat/loopback/link-local/metadata (`169.254.169.254`), batasi ukuran dan timeout, jangan ikuti redirect otomatis.
6. **Path traversal / nama berkas**: nama berkas dari pengguna tidak pernah dipakai sebagai path atau key (§9).
7. **Prototype pollution / deserialisasi**: jangan `Object.assign`/spread input mentah ke objek konfigurasi; jangan `JSON.parse` lalu mempercayai bentuknya tanpa Zod.
8. **Open redirect**: lihat §2.6.
9. **CSRF**: Server Action memakai pengecekan `Origin` vs `Host` bawaan Next (POST saja). Jangan menonaktifkan; bila di belakang proxy/domain ganda isi `experimental.serverActions.allowedOrigins` seminimal mungkin. **Route Handler yang mengubah data dan memakai cookie sesi wajib memeriksa header `Origin`/`Sec-Fetch-Site`** sendiri (atau memakai token), dan mutasi **tidak pernah** lewat `GET`. Webhook memakai verifikasi tanda tangan (§10), bukan cookie.
10. **Server Action body**: pertahankan `serverActions.bodySizeLimit` kecil (default 1 MB); berkas besar lewat presigned upload (§9).

---

## 5. Header keamanan dan CSP

Wajib aktif di production (`next.config` untuk header statis, `src/proxy.ts` untuk CSP ber-nonce). Verifikasi dengan `curl -I` atau securityheaders.com.

| Header | Nilai |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (tambah `preload` hanya atas keputusan user) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (dan CSP `frame-ancestors 'none'`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` (buka hanya yang dipakai) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy` | lihat di bawah |
| `X-Powered-By` | hapus: `poweredByHeader: false` |

CSP dasar (sesuaikan domain R2 dan layanan yang benar-benar dipakai; **tanpa `unsafe-eval`** di production):

```
default-src 'self';
script-src 'self' 'nonce-<nonce>' 'strict-dynamic';
style-src 'self' 'nonce-<nonce>';          # 'unsafe-inline' hanya bila terbukti perlu, catat alasannya
img-src 'self' blob: data: https://<domain-media-r2>;
font-src 'self';
connect-src 'self' https://<endpoint-r2-untuk-upload>;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

- Nonce dibuat per request di proxy (`crypto.randomUUID()` → base64) dan diteruskan lewat header `x-nonce`; konsekuensinya halaman yang memakai nonce **dirender dinamis** (`await connection()`), tidak bisa di-cache statis di CDN. Untuk halaman publik yang sensitif performa (profil vendor), pertimbangkan ulang kompromi ini per fitur dan catat keputusannya di tiket.
- Tambah dulu dengan `Content-Security-Policy-Report-Only` bila ada risiko memecah halaman, lalu naikkan ke enforce.
- Skrip pihak ketiga (analytics, widget): butuh persetujuan user; pakai SRI bila dari CDN; hindari bila bisa.

---

## 6. Cookie, sesi, dan data di browser

- Token/sesi tidak disimpan di `localStorage`/`sessionStorage`. Cookie buatan sendiri: `httpOnly`, `secure`, `sameSite`, `path` sempit, umur seperlunya. **[hook]**
- Data sensitif tidak ditaruh di URL (query string) atau di `NEXT_PUBLIC_*`.
- Respons berisi data pribadi: `Cache-Control: private, no-store`.

---

## 7. Rate limit dan anti-penyalahgunaan

1. Rate limit **server-side** (Upstash Ratelimit/Redis, atau Vercel Firewall/WAF; in-memory tidak berlaku di serverless) pada: login, daftar, lupa/reset sandi, kirim email/OTP, pembuatan presigned URL, formulir kontak, dan semua endpoint tulis. Kunci per **IP + identitas** (email/userId).
2. IP klien diambil dari header platform tepercaya (Vercel: `x-real-ip` / `x-forwarded-for` yang diisi Vercel); jangan mempercayai header buatan klien.
3. Jawab `429` dengan `Retry-After`; kegagalan login beruntun → penundaan bertahap/CAPTCHA (Turnstile) setelah ambang.
4. Batasi ukuran payload, jumlah item per permintaan, dan kedalaman/kompleksitas kueri. Paginasi wajib (`RULES.md` §4).
5. Operasi mahal (email massal, pemrosesan gambar) dibatasi kuota per pengguna.

---

## 8. Database (Supabase / Neon + Prisma)

1. Koneksi **TLS wajib** (`sslmode=require`). Runtime memakai connection **pooled** (`DATABASE_URL`: Supabase pooler port 6543 `pgbouncer=true`; Neon host `-pooler`); migrasi memakai koneksi langsung (`DIRECT_URL`).
2. **Least privilege**: role aplikasi hanya DML pada tabel yang dipakai; role migrasi (DDL) tidak dipakai oleh aplikasi runtime dan hanya dijalankan user/CI terproteksi.
3. **Supabase**: kunci `service_role` **tidak pernah** di klien atau `NEXT_PUBLIC_*`. Prisma menyambung langsung sebagai role Postgres dan **melewati RLS**, jadi otorisasi tetap di kode (§3). Bila Data API (PostgREST)/`anon` key aktif tetapi tidak dipakai: matikan, atau **aktifkan RLS di semua tabel tanpa policy** agar `anon` tidak bisa membaca apa pun. Bila klien Supabase dipakai dari browser: RLS dengan policy eksplisit per tabel + tes.
4. **Neon**: pisahkan branch/proyek untuk production dan dev; kredensial production tidak ada di mesin developer.
5. Data sensitif (token API pihak ketiga, secret TOTP) dienkripsi di level aplikasi (AES-256-GCM, kunci dari env) bila memang harus disimpan; token reset/verifikasi disimpan **hash**-nya.
6. Backup/PITR aktif di penyedia; pemulihan diuji berkala (tugas user).
7. Perintah destruktif Prisma ditolak hook: `migrate reset`, `db push --accept-data-loss`, `migrate deploy`, `db execute`. **[hook]**

---

## 9. Upload dan penyimpanan (Cloudflare R2)

1. **Bucket privat.** Tidak ada ACL publik; akses baca lewat **presigned GET** berumur singkat (≤ 5 menit) atau lewat route yang memeriksa otorisasi. Aset publik non-sensitif (mis. gambar showcase) boleh lewat custom domain khusus bucket terpisah, sadar bahwa siapa pun yang tahu URL bisa membuka. **[hook: ACL public-read ditolak]**
2. **Alur upload**: (a) klien meminta presign ke Server Action/route yang memeriksa login + kuota + rate limit; (b) server memvalidasi `contentType` dari **daftar putih** (mis. `image/jpeg|png|webp`, `application/pdf`) dan `size` ≤ batas (mis. 5 MB gambar); (c) server membuat **key sendiri**: `uploads/<userId>/<uuid>.<ext>` dengan ekstensi dari pemetaan MIME tervalidasi, **bukan** nama berkas pengguna; (d) presigned PUT berumur ≤ 5 menit, menandatangani `Content-Type` dan `Content-Length` (R2 tidak mendukung presigned POST policy; cek dokumentasi R2/SDK versi terpasang); (e) setelah unggah, server **memverifikasi ulang** (`HEAD`: ukuran, content-type) dan, untuk gambar, memeriksa *magic bytes*/memproses ulang (mis. `sharp`, sekaligus membuang EXIF/GPS) sebelum menandai berkas valid di DB.
3. **Dilarang**: SVG dan HTML dari pengguna (vektor XSS) kecuali disanitasi; nama berkas pengguna sebagai key; mempercayai `Content-Type`/ekstensi dari klien; menyajikan berkas pengguna dari origin yang sama dengan aplikasi tanpa `Content-Disposition`/`nosniff`.
4. Berkas non-gambar disajikan dengan `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff`.
5. Objek yatim (diunggah tetapi tidak pernah dikonfirmasi) dibersihkan lewat lifecycle rule R2. Hapus berkas saat record DB-nya dihapus.
6. **CORS bucket**: hanya origin aplikasi, hanya metode yang dipakai (`PUT`/`GET`), bukan `*`. **[hook: wildcard ditolak]**
7. Kunci R2: token API **dibatasi ke satu bucket** dengan izin minimum (Object Read & Write), bukan token admin akun; terpisah dev/production; rotasi berkala.
8. Pindai malware untuk berkas yang akan diunduh pengguna lain (bila fitur berbagi berkas ada) → keputusan user.

---

## 10. Webhook dan integrasi pihak ketiga

- Verifikasi **tanda tangan** (HMAC dengan perbandingan waktu konstan `crypto.timingSafeEqual`) dan timestamp (tolak > 5 menit) atas **body mentah** (`await req.text()`), sebelum parse/proses. Idempotensi lewat ID event yang disimpan.
- Panggilan keluar: timeout, batas ukuran respons, tanpa meneruskan header/cookie pengguna, kunci API dari `serverEnv`.
- Jangan menaruh kunci layanan pihak ketiga di klien; panggil lewat server.

---

## 11. Error, log, dan privasi

1. Klien menerima pesan **generik**; stack trace, query, dan nama tabel tidak pernah dikirim. Halaman `error.tsx`/`global-error.tsx` tanpa detail internal.
2. Log server **tanpa**: sandi, token, cookie, header `Authorization`, DB URL, isi berkas, data pribadi lengkap. Redaksi field sensitif di logger. **[hook: console.log data sensitif ditolak]**
3. Kumpulkan data pribadi seminimal mungkin; tentukan masa simpan; sediakan hapus akun yang benar-benar menghapus data dan objek R2 terkait.
4. `source map` produksi tidak dipublikasikan (`productionBrowserSourceMaps: false`, default).
5. Audit log (login, ganti sandi/email, aksi admin, hapus data) tersimpan di tabel append-only dengan `userId`, IP, waktu.

---

## 12. Dependensi dan rantai pasok

1. **Tanpa dependensi baru tanpa persetujuan user** (`RULES.md` §7). Pilih paket mapan; tolak paket yang baru/tidak terawat/nama mirip paket populer (typosquatting).
2. `package-lock.json` selalu di-commit; CI memakai `npm ci`. Tidak ada `*`/`latest` pada versi.
3. `npm audit --omit=dev` tanpa High/Critical sebelum merge; Dependabot (security + version updates mingguan) aktif (tugas user di GitHub).
4. Skrip `postinstall` paket baru diperiksa; pertimbangkan `npm config set ignore-scripts true` di CI lalu jalankan yang perlu secara eksplisit.
5. GitHub Actions: `permissions:` minimal per job (default `contents: read`), action pihak ketiga di-**pin ke commit SHA**, tidak ada `pull_request_target` yang mengeksekusi kode PR, rahasia tidak diteruskan ke PR dari fork. Secret scanning + push protection aktif.
6. `.npmrc` dengan token tidak di-commit. **[hook]**

---

## 13. Checklist keamanan tiap PR

Tulis di deskripsi PR dan dokumen implementasi (centang yang relevan, jelaskan yang tidak):

- [ ] Tidak ada rahasia di diff; `.env.example` hanya nama variabel
- [ ] Semua input baru divalidasi Zod di server (`.strict()`, batas panjang)
- [ ] Setiap action/route baru: otentikasi + otorisasi + cek kepemilikan di query
- [ ] Tes: jalur berhasil, input tidak valid, **akses ditolak**, **IDOR**
- [ ] Tidak ada data sensitif ke Client Component, log, atau URL
- [ ] Tidak ada `dangerouslySetInnerHTML`/raw SQL tidak aman/`eval` (atau `sec-ok` beralasan dan disetujui)
- [ ] Mutasi bukan `GET`; Route Handler pemakai cookie memeriksa `Origin`
- [ ] Endpoint rawan abuse berlimit laju
- [ ] Upload: tipe/ukuran/key divalidasi server, bucket tetap privat
- [ ] Dependensi: tidak ada tambahan, atau sudah disetujui + `npm audit` bersih
- [ ] Header/CSP tidak dilonggarkan (atau dilonggarkan dengan alasan tertulis)
- [ ] Pesan error generik; tidak membocorkan keberadaan akun/resource

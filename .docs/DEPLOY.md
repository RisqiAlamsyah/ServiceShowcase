# DEPLOY.md — Vercel dan pengaturan GitHub (dikerjakan user)

> Claude tidak mengubah pengaturan GitHub maupun Vercel. Dokumen ini adalah langkah untuk user. Repo: `RisqiAlamsyah/ServiceShowcase`.

## 1. Pengaturan GitHub

Buka **Settings** repo di GitHub.

### 1.1 Default branch
Settings → General → Default branch → ganti ke `development` (supaya PR otomatis menuju ke sana).

### 1.2 Branch protection (Settings → Branches → Add branch ruleset / protection rule)
Buat untuk **`main`** dan **`development`**:
- Require a pull request before merging (minimal 0 approval bila Anda sendirian; tetap wajib lewat PR).
- Require status checks to pass before merging, pilih check berikut (nama persis dari `ci.yml`; muncul setelah CI berjalan sekali):
  - `Lint, typecheck, format, test`
  - `Build`
  - `npm audit`
  - `Secret scan`
  - `E2E (Playwright)`
- Require branches to be up to date before merging.
- Block force pushes dan restrict deletions.
- Untuk `main`: gunakan **Merge commit** saat promosi `development` → `main` (jangan squash).

### 1.3 Keamanan kode (Settings → Code security)
- Dependabot alerts: **Enable**
- Dependabot security updates: **Enable** (version updates sudah diatur di `.github/dependabot.yml`)
- Secret scanning: **Enable**, dan **Push protection**: **Enable**
- Akun GitHub: aktifkan 2FA.

### 1.4 Actions (Settings → Actions → General)
- Workflow permissions: **Read repository contents permission**.
- Fork pull request workflows: **Require approval** untuk kontributor luar.

## 2. Vercel

1. Masuk ke vercel.com (paket Hobby gratis cukup), pilih **Add New → Project → Import** repo `ServiceShowcase`.
2. Framework preset: **Next.js** (terdeteksi otomatis). Build/Install command biarkan default.
3. **Production Branch**: `main` (Settings → Git). Preview dibuat otomatis untuk setiap PR.
4. **Environment Variables** (Settings → Environment Variables), isi terpisah per lingkungan (Production / Preview / Development):

   | Nama | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | URL domain production, tanpa `/` di akhir | URL preview (mis. `https://<project>-git-<branch>-<tim>.vercel.app`) atau domain staging tetap |

   Variabel rahasia berikutnya (`DATABASE_URL`, `AUTH_SECRET`, `R2_*`) ditambahkan oleh user pada tiket terkait. Gunakan **kunci berbeda** per lingkungan; kunci production tidak dipakai di Preview.
5. Settings → Deployment Protection: biarkan **Vercel Authentication** aktif untuk Preview agar tidak terbuka publik. Anda bisa membuka preview dari ponsel dengan login Vercel yang sama.
6. Deploy pertama berjalan otomatis. Untuk melihat preview PR: buka tab Checks/komentar bot Vercel di PR.

## 3. Verifikasi setelah pengaturan
- Buka PR kecil ke `development`: semua check CI hijau dan komentar preview Vercel muncul.
- Coba push langsung ke `main`/`development`: harus ditolak.
- Cek header di URL production: `curl -I https://<domain>` memuat header keamanan (`RULES_SECURITY.md` §5).

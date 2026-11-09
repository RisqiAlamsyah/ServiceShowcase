# RULES_FRONTEND.md — Aturan Frontend (UI, Tailwind, Form)

> Dibaca saat membuat atau mengubah komponen, halaman, atau gaya. Keamanan UI ada di `RULES_SECURITY.md` §4-§6; pola kode di `RULES_TEMPLATES.md`.

---

## 1. Prinsip

1. **Server Component default**; `"use client"` hanya bila perlu interaktivitas dan serendah mungkin di pohon (`RULES.md` §3).
2. **Ikuti komponen terdekat** (struktur, penamaan, varian). Cek `src/components/ui/` sebelum membuat baru.
3. **Tanpa library UI baru** tanpa persetujuan user (`RULES.md` §7). Utilitas yang boleh diusulkan: `clsx` + `tailwind-merge` (helper `cn()`), `class-variance-authority`, primitif aksesibel (Radix/shadcn-ui) bila user setuju.
4. Tidak ada logika bisnis, query, atau akses env rahasia di komponen. Data masuk lewat props dari Server Component/service.
5. Tidak ada rahasia atau data sensitif pada props Client Component (`RULES.md` §3.3).

---

## 2. Tailwind

- Tema (warna, font, radius, spacing) didefinisikan sekali di `tailwind.config.ts`/CSS theme; **tidak ada nilai arbitrer berulang** (`w-[137px]`, `text-[#3a3a3a]`). Warna lewat token (`bg-primary`, `text-muted`).
- Urutan class dirapikan otomatis (`prettier-plugin-tailwindcss`). Gabungkan class kondisional dengan `cn()`, bukan template string manual.
- Mobile-first (`sm:`, `md:`, `lg:`); uji di 360 px dan 1280 px. Dukungan dark mode lewat `dark:` hanya bila diminta.
- Ekstrak komponen (bukan `@apply` panjang) bila pola class berulang ≥ 3 kali.
- Tanpa CSS inline `style={{}}` untuk hal yang bisa lewat class; nilai dinamis dari data pengguna **tidak** ditempel ke `style`/class tanpa validasi (cegah CSS injection).

---

## 3. Form dan interaksi

- Validasi klien memakai skema Zod yang **sama** dengan server (`src/lib/validation/`), hanya untuk UX; server tetap memvalidasi ulang.
- Form memakai `<form action={serverAction}>` + `useActionState`/`useFormStatus`: tampilkan `fieldErrors`, nonaktifkan tombol saat pending, fokus ke error pertama.
- Tampilkan **pesan dari `ActionResult.message`** apa adanya; jangan membangun pesan dari objek error mentah.
- Tidak ada `alert()`/`console.log` tertinggal. Notifikasi lewat komponen toast/banner proyek.
- Aksi destruktif (hapus) meminta konfirmasi dan memakai tombol `type="submit"` dalam form (bukan `GET` link).

---

## 4. Output aman

- Teks pengguna dirender sebagai child React (`{value}`), tidak lewat `dangerouslySetInnerHTML`/`innerHTML` (**[hook]**). Rich text hanya dengan sanitasi server dan persetujuan (`RULES_SECURITY.md` §4.3).
- `href`/`src` dari data pengguna divalidasi skema `https:`; link eksternal `target="_blank" rel="noopener noreferrer"`.
- Gambar lewat `next/image` dengan `remotePatterns` **sempit** (hostname R2 spesifik, bukan `**`). Tanpa `dangerouslyAllowSVG`.
- Tidak ada skrip pihak ketiga tanpa persetujuan (CSP akan memblokir; SRI bila CDN).

---

## 5. Aksesibilitas dan kualitas

- Elemen semantik (`button`, `nav`, `main`, `label` terhubung ke input), `alt` bermakna pada gambar, fokus terlihat, kontras WCAG AA, navigasi keyboard utuh, `aria-live` untuk pesan status.
- Setiap halaman punya `metadata` (title, description) dan `loading.tsx`/`error.tsx` bila mengambil data. `error.tsx` tidak menampilkan detail error internal.
- Gambar dioptimalkan (`next/image`, ukuran eksplisit untuk cegah layout shift); font lewat `next/font`.
- Performa: hindari `"use client"` di layout besar; impor library berat secara dinamis (`next/dynamic`) hanya bila perlu.

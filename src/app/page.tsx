import Link from "next/link";
import { connection } from "next/server";

// Dirender dinamis agar nonce CSP dari proxy diterapkan (lihat src/proxy.ts).
export default async function HomePage() {
  await connection();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-semibold tracking-widest text-accent-strong uppercase">
        ServiceShowcase
      </p>
      <h1 className="font-heading text-4xl leading-tight font-semibold sm:text-5xl">
        Portofolio dan estimasi harga, dalam satu tautan.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        Untuk MUA, fotografer, dan videografer: tampilkan karya, susun paket, dan biarkan calon
        klien menghitung biaya sendiri sebelum memesan lewat WhatsApp.
      </p>
      <p className="mt-10 text-sm text-muted">Sedang dibangun. Fitur pertama sudah bisa dicoba:</p>
      <Link
        href="/demo"
        className="mt-3 inline-flex min-h-11 max-w-fit items-center rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90"
      >
        Coba kalkulator estimasi
      </Link>
    </main>
  );
}

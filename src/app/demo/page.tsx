import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { PriceCalculator } from "@/components/booking/price-calculator";
import { todayInJakarta } from "@/lib/booking/date";
import { SAMPLE_PACKAGES, SAMPLE_VENDOR } from "@/lib/booking/sample-data";

export const metadata: Metadata = {
  title: "Contoh kalkulator estimasi",
  description: "Demo kalkulator estimasi biaya dan pratinjau pesan WhatsApp.",
  robots: { index: false, follow: false },
};

// searchParams tidak tepercaya: nilai di luar daftar (termasuk array/markup) jatuh ke "pro", tidak pernah melempar error.
const searchSchema = z.object({ tier: z.enum(["free", "pro"]).catch("pro") });

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // dirender dinamis agar nonce CSP dari proxy diterapkan
  const { tier } = searchSchema.parse(await searchParams);
  const isFree = tier === "free";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-semibold tracking-widest text-accent-strong uppercase">
        Halaman demo
      </p>
      <h1 className="mt-2 font-heading text-3xl leading-tight font-semibold sm:text-4xl">
        {SAMPLE_VENDOR.name}
      </h1>
      <p className="mt-3 text-muted">
        Beginilah calon klien akan menghitung biaya sendiri sebelum memesan. Data di halaman ini
        hanya contoh.
      </p>

      <p className="mt-4 text-sm text-muted">
        Tampilan sebagai paket:{" "}
        {isFree ? (
          <>
            <strong className="text-ink">Free</strong> ·{" "}
            <Link href="/demo" className="underline underline-offset-2">
              lihat Pro
            </Link>
          </>
        ) : (
          <>
            <strong className="text-ink">Pro</strong> ·{" "}
            <Link href="/demo?tier=free" className="underline underline-offset-2">
              lihat Free
            </Link>
          </>
        )}
      </p>

      <div className="mt-8">
        <PriceCalculator
          vendorPhone={SAMPLE_VENDOR.phone}
          packages={SAMPLE_PACKAGES}
          allowAddons={!isFree}
          todayIso={todayInJakarta()}
        />
      </div>
    </main>
  );
}

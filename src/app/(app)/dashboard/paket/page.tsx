import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PackageForm } from "@/components/package/package-form";
import { formatRupiah } from "@/lib/money";
import { PLAN_LIMITS, publiclyVisiblePackageIds } from "@/lib/plans";
import { getCurrentUser } from "@/server/auth/guards";
import { listPackagesForUser } from "@/server/package/service";

export const metadata: Metadata = { title: "Paket" };

export default async function PackagesPage() {
  await connection();
  const user = await getCurrentUser(); // lapis kedua setelah layout (app)
  if (!user) redirect("/masuk?next=/dashboard/paket");

  // Hanya paket milik pengguna ini (kepemilikan ikut di query).
  const packages = await listPackagesForUser(user.id);
  const limit = PLAN_LIMITS[user.plan].maxPackages;
  const visible = publiclyVisiblePackageIds(user.plan, packages);
  const hiddenCount = packages.length - visible.size;
  const atLimit = packages.length >= limit;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-accent-strong underline">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold">Paket jasa</h1>
      <p className="mt-2 text-muted">
        Paket yang Anda tawarkan di halaman publik. Paket {user.plan === "FREE" ? "Free" : "Pro"}:{" "}
        {packages.length} dari {limit} paket terpakai
        {user.plan === "FREE" ? "; add-on tersedia di Pro" : ""}.
      </p>

      {hiddenCount > 0 ? (
        <p role="note" className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
          {hiddenCount} paket disembunyikan dari halaman publik karena melewati batas paket Free.
          Tidak ada yang dihapus; semuanya tampil lagi bila Anda kembali ke Pro.
        </p>
      ) : null}

      <section aria-labelledby="package-list" className="mt-8">
        <h2 id="package-list" className="sr-only">
          Daftar paket
        </h2>
        {packages.length === 0 ? (
          <p className="text-muted">Belum ada paket. Tambahkan paket pertama Anda di bawah.</p>
        ) : (
          <ul className="space-y-3">
            {packages.map((p) => (
              <li key={p.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted">
                      {formatRupiah(p.basePrice)} · {p.addons.length} add-on
                    </p>
                  </div>
                  <span
                    className={
                      visible.has(p.id)
                        ? "rounded-sm border border-line px-2 py-1 text-xs font-semibold"
                        : "rounded-sm border border-danger px-2 py-1 text-xs font-semibold text-danger"
                    }
                  >
                    {visible.has(p.id) ? "Tampil di halaman publik" : "Disembunyikan"}
                  </span>
                </div>
                <Link
                  href={`/dashboard/paket/${p.id}`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong underline"
                >
                  Kelola paket {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="package-new" className="mt-10">
        <h2 id="package-new" className="font-heading text-2xl font-semibold">
          Tambah paket
        </h2>
        {atLimit ? (
          <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm">
            Batas {limit} paket tercapai. Hapus paket lain
            {user.plan === "FREE" ? " atau upgrade ke Pro" : ""} untuk menambah.
          </p>
        ) : (
          <div className="mt-4">
            <PackageForm mode="create" />
          </div>
        )}
      </section>
    </main>
  );
}

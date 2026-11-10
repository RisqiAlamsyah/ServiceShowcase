import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { deleteAddonAction, deletePackageAction } from "@/actions/package";
import { AddonForm } from "@/components/package/addon-form";
import { PackageForm } from "@/components/package/package-form";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { formatRupiah } from "@/lib/money";
import { MAX_ADDONS_PER_PACKAGE, PLAN_LIMITS, publiclyVisiblePackageIds } from "@/lib/plans";
import { idSchema } from "@/lib/validation/package";
import { getCurrentUser } from "@/server/auth/guards";
import { getPackageForUser, listPackagesForUser } from "@/server/package/service";

export const metadata: Metadata = { title: "Kelola paket" };

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params; // Next 15+: params adalah Promise
  const user = await getCurrentUser(); // lapis kedua setelah layout (app)
  if (!user) redirect("/masuk?next=/dashboard/paket");

  // Id tidak valid atau bukan milik pengguna: 404 (bukan 403) agar keberadaannya tidak bocor.
  if (!idSchema.safeParse(id).success) notFound();
  const pkg = await getPackageForUser(user.id, id);
  if (!pkg) notFound();

  const all = await listPackagesForUser(user.id);
  const isVisible = publiclyVisiblePackageIds(user.plan, all).has(pkg.id);
  const addonsAllowed = PLAN_LIMITS[user.plan].addonsAllowed;
  const canAddAddon = addonsAllowed && pkg.addons.length < MAX_ADDONS_PER_PACKAGE;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/dashboard/paket" className="text-sm font-semibold text-accent-strong underline">
        ← Semua paket
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold">{pkg.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {isVisible
          ? "Paket ini tampil di halaman publik."
          : "Paket ini disembunyikan dari halaman publik karena melewati batas paket Free."}
      </p>

      <section aria-labelledby="package-edit" className="mt-8">
        <h2 id="package-edit" className="font-heading text-2xl font-semibold">
          Detail paket
        </h2>
        <div className="mt-4">
          <PackageForm
            mode="edit"
            packageId={pkg.id}
            initial={{
              title: pkg.title,
              description: pkg.description,
              basePrice: String(pkg.basePrice),
            }}
          />
        </div>
      </section>

      <section aria-labelledby="addon-list" className="mt-10">
        <h2 id="addon-list" className="font-heading text-2xl font-semibold">
          Add-on
        </h2>

        {!addonsAllowed ? (
          <p role="note" className="mt-3 rounded-md border border-line bg-surface p-3 text-sm">
            Add-on tersedia di paket Pro.
            {pkg.addons.length > 0
              ? " Add-on yang sudah ada tersimpan, tetapi disembunyikan dari halaman publik."
              : ""}
          </p>
        ) : null}

        {pkg.addons.length === 0 ? (
          <p className="mt-3 text-muted">Belum ada add-on.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pkg.addons.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-semibold">
                  {a.name} <span className="font-normal text-muted">· {formatRupiah(a.price)}</span>
                </h3>
                <div className="mt-3">
                  <AddonForm
                    mode="edit"
                    addonId={a.id}
                    initial={{ name: a.name, price: String(a.price) }}
                  />
                </div>
                <div className="mt-3">
                  <ConfirmDeleteForm
                    action={deleteAddonAction}
                    id={a.id}
                    label={`Hapus add-on ${a.name}`}
                    subject="add-on ini"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {canAddAddon ? (
          <div className="mt-6">
            <h3 className="font-semibold">Tambah add-on</h3>
            <div className="mt-3">
              <AddonForm mode="create" packageId={pkg.id} />
            </div>
          </div>
        ) : addonsAllowed ? (
          <p className="mt-4 text-sm text-muted">
            Batas {MAX_ADDONS_PER_PACKAGE} add-on per paket tercapai.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="package-delete" className="mt-12 border-t border-line pt-8">
        <h2 id="package-delete" className="font-heading text-2xl font-semibold">
          Hapus paket
        </h2>
        <p className="mt-2 text-sm text-muted">
          Menghapus paket juga menghapus semua add-on di dalamnya.
        </p>
        <div className="mt-4">
          <ConfirmDeleteForm
            action={deletePackageAction}
            id={pkg.id}
            label="Hapus paket"
            subject={`paket "${pkg.title}"`}
          />
        </div>
      </section>
    </main>
  );
}

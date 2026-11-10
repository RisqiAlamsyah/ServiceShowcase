import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { logoutAction } from "@/actions/auth";
import { clientEnv } from "@/lib/env.client";
import { requireUser } from "@/server/auth/guards";
import { PLAN_LIMITS } from "@/lib/plans";
import { listPackagesForUser } from "@/server/package/service";
import { getProfileForUser } from "@/server/profile/service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await connection();
  const user = await requireUser(); // lapis kedua setelah layout
  const [profile, packages] = await Promise.all([
    getProfileForUser(user.id),
    listPackagesForUser(user.id),
  ]);
  const siteHost = new URL(clientEnv.NEXT_PUBLIC_SITE_URL).host;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold">Halo, {user.name ?? user.email}</h1>

      <section
        aria-labelledby="profile-status"
        className="mt-8 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="profile-status" className="font-semibold">
          Profil bisnis
        </h2>
        {profile ? (
          <p className="mt-2 text-muted">
            {profile.businessName} · alamat halaman{" "}
            <strong className="text-ink">
              {siteHost}/{profile.slug}
            </strong>
          </p>
        ) : (
          <p className="mt-2 text-muted">
            Profil belum dibuat. Lengkapi nama bisnis, nomor WhatsApp, dan alamat halaman Anda.
          </p>
        )}
        <Link
          href="/dashboard/profil"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90"
        >
          {profile ? "Ubah profil" : "Lengkapi profil"}
        </Link>
      </section>

      <section
        aria-labelledby="package-status"
        className="mt-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="package-status" className="font-semibold">
          Paket dan add-on
        </h2>
        <p className="mt-2 text-muted">
          {packages.length} dari {PLAN_LIMITS[user.plan].maxPackages} paket terpakai.
        </p>
        <Link
          href="/dashboard/paket"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90"
        >
          {packages.length > 0 ? "Kelola paket" : "Tambah paket"}
        </Link>
      </section>

      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="min-h-11 rounded-md border border-ink px-5 py-3 font-semibold hover:bg-ink/5"
        >
          Keluar
        </button>
      </form>
    </main>
  );
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { logoutAction } from "@/actions/auth";
import { requireUser } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await connection();
  const user = await requireUser(); // lapis kedua setelah layout

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold">Halo, {user.name ?? user.email}</h1>
      <p className="mt-3 text-muted">
        Akun Anda aktif. Pengaturan profil, paket, dan portofolio akan hadir di fitur berikutnya.
      </p>
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

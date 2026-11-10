import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { clientEnv } from "@/lib/env.client";
import { getCurrentUser } from "@/server/auth/guards";
import { getProfileForUser } from "@/server/profile/service";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  await connection();
  const user = await getCurrentUser(); // lapis kedua setelah layout (app)
  if (!user) redirect("/masuk?next=/dashboard/profil");

  // Hanya profil milik pengguna ini (kepemilikan ikut di query).
  const profile = await getProfileForUser(user.id);
  const siteHost = new URL(clientEnv.NEXT_PUBLIC_SITE_URL).host;

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-accent-strong underline">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold">Profil bisnis</h1>
      <p className="mt-2 text-muted">
        Informasi ini tampil di halaman publik Anda dan dipakai untuk tombol WhatsApp.
      </p>
      <div className="mt-8">
        <ProfileForm
          siteHost={siteHost}
          initial={
            profile
              ? {
                  businessName: profile.businessName,
                  whatsapp: profile.whatsapp,
                  bio: profile.bio ?? "",
                  slug: profile.slug,
                }
              : null
          }
        />
      </div>
    </main>
  );
}

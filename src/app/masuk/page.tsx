import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun ServiceShowcase Anda.",
};

type SearchParams = Promise<{ next?: string | string[]; daftar?: string | string[] }>;

// Dirender dinamis agar nonce CSP dari proxy diterapkan.
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);

  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-widest text-accent-strong uppercase">
        ServiceShowcase
      </p>
      <h1 className="font-heading text-3xl font-semibold">Masuk</h1>

      {params.daftar === "1" ? (
        <p role="status" className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
          Pendaftaran diproses. Silakan masuk dengan email dan sandi Anda.
        </p>
      ) : null}

      <div className="mt-8">
        <LoginForm next={next} />
      </div>

      <p className="mt-8 text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-accent-strong underline">
          Daftar
        </Link>
      </p>
    </main>
  );
}

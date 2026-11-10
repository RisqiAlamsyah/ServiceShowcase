import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun ServiceShowcase untuk membuat halaman portofolio Anda.",
};

// Dirender dinamis agar nonce CSP dari proxy diterapkan.
export default async function RegisterPage() {
  await connection();
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-widest text-accent-strong uppercase">
        ServiceShowcase
      </p>
      <h1 className="font-heading text-3xl font-semibold">Buat akun</h1>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-8 text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-accent-strong underline">
          Masuk
        </Link>
      </p>
    </main>
  );
}

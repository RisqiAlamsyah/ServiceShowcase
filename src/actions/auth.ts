"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/server/auth/password";
import { RATE_RULES, clientIp, consume } from "@/server/auth/rate-limit";
import { createCredentialsUser } from "@/server/user/service";
import type { ActionResult } from "@/types/action";

// Pesan sengaja generik: tidak membedakan email salah, sandi salah, atau terlalu banyak percobaan.
const LOGIN_FAILED = "Email atau sandi salah, atau terlalu banyak percobaan. Coba lagi nanti.";
const INTERNAL = "Terjadi kesalahan. Coba lagi.";

type FormState = ActionResult | null;

function field(formData: FormData, name: string): unknown {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Validasi lebih dulu: murah dan tanpa efek samping, lalu rate limit sebelum pekerjaan mahal.
  const parsed = registerSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Periksa kembali isian Anda.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const ip = clientIp(await headers());
    if (!(await consume("register:ip", ip, RATE_RULES.registerIp))) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Terlalu banyak permintaan. Coba lagi nanti.",
      };
    }

    // Hash selalu dihitung (juga saat email sudah ada) agar waktu respons tidak membedakan.
    const passwordHash = await hashPassword(parsed.data.password);
    await createCredentialsUser({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    });
  } catch (e) {
    console.error("registerAction gagal", e instanceof Error ? e.name : "unknown");
    return { ok: false, code: "INTERNAL", message: INTERNAL };
  }

  // Jalur yang sama untuk email baru maupun yang sudah terdaftar (anti-enumerasi).
  redirect("/masuk?daftar=1");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
    next: field(formData, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Periksa kembali isian Anda.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectPath(parsed.data.next),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, code: "UNAUTHENTICATED", message: LOGIN_FAILED };
    }
    // Redirect sukses dilempar sebagai error khusus Next; harus diteruskan.
    throw e;
  }
  return null;
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

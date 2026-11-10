"use server";

import { revalidatePath } from "next/cache";
import { saveProfileSchema } from "@/lib/validation/profile";
import { AuthError, requireUser } from "@/server/auth/guards";
import { RATE_RULES, consume } from "@/server/auth/rate-limit";
import { getProfileForUser, saveProfile } from "@/server/profile/service";
import type { FormState, FormValues } from "@/types/action";

type ProfileFormState = FormState<{ slug: string }>;

const FIELDS = ["businessName", "whatsapp", "bio", "slug"] as const;

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

// Nilai mentah yang dikirim balik ke form (non-rahasia) supaya isian tidak hilang saat gagal.
function submittedValues(formData: FormData): FormValues {
  return Object.fromEntries(FIELDS.map((f) => [f, text(formData, f) ?? ""]));
}

export async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = submittedValues(formData);

  try {
    // 1. otentikasi; ownerId selalu dari sesi, tidak pernah dari input
    const user = await requireUser();

    // 2. rate limit endpoint tulis
    if (!(await consume("profile:write", user.id, RATE_RULES.profileWrite))) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Terlalu banyak permintaan. Coba lagi nanti.",
        values,
      };
    }

    // 3. validasi server (field dipilih eksplisit, lalu skema .strict())
    const parsed = saveProfileSchema.safeParse({
      businessName: text(formData, "businessName"),
      whatsapp: text(formData, "whatsapp"),
      bio: text(formData, "bio") ?? "",
      slug: text(formData, "slug"),
      confirmSlugChange: text(formData, "confirmSlugChange"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Periksa kembali isian Anda.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        values,
      };
    }

    // 4. mengganti slug yang sudah ada: wajib konfirmasi dan dibatasi (link lama akan mati)
    const existing = await getProfileForUser(user.id);
    if (existing && existing.slug !== parsed.data.slug) {
      if (!parsed.data.confirmSlugChange) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Periksa kembali isian Anda.",
          fieldErrors: {
            confirmSlugChange: ["Centang kotak ini untuk mengonfirmasi penggantian slug."],
          },
          values,
        };
      }
      if (!(await consume("profile:slug", user.id, RATE_RULES.slugChange))) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          message: "Slug hanya bisa diganti 3 kali per hari. Coba lagi besok.",
          values,
        };
      }
    }

    // 5. simpan lewat service
    const result = await saveProfile(user.id, parsed.data);
    if (!result.ok) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Periksa kembali isian Anda.",
        fieldErrors: { slug: ["Slug sudah dipakai. Pilih yang lain."] },
        values,
      };
    }

    // 6. revalidasi tepat sasaran
    revalidatePath("/dashboard/profil");
    revalidatePath("/dashboard");

    return {
      ok: true,
      data: { slug: result.profile.slug },
      values: {
        businessName: result.profile.businessName,
        whatsapp: result.profile.whatsapp,
        bio: result.profile.bio ?? "",
        slug: result.profile.slug,
      },
    };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, code: "UNAUTHENTICATED", message: "Silakan masuk.", values };
    }
    // Hanya nama error ke log; tanpa pesan/isi yang bisa memuat data pribadi.
    console.error("saveProfileAction gagal", e instanceof Error ? e.name : "unknown");
    return { ok: false, code: "INTERNAL", message: "Terjadi kesalahan. Coba lagi.", values };
  }
}

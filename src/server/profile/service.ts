import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { SaveProfileInput } from "@/lib/validation/profile";

const PROFILE_SELECT = {
  slug: true,
  businessName: true,
  whatsapp: true,
  bio: true,
} as const;

export type OwnProfile = {
  slug: string;
  businessName: string;
  whatsapp: string;
  bio: string | null;
};

// Kepemilikan ikut di query: profil dicari lewat ownerId dari sesi (RULES_SECURITY §3.2).
export function getProfileForUser(userId: string): Promise<OwnProfile | null> {
  return db.profile.findUnique({ where: { ownerId: userId }, select: PROFILE_SELECT });
}

export type SaveProfileResult =
  { ok: true; profile: OwnProfile } | { ok: false; code: "SLUG_TAKEN" };

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// `ownerId` berasal dari sesi, bukan input. Field yang boleh diubah ditentukan eksplisit (anti mass
// assignment). Keunikan slug ditegakkan constraint DB; di sini hanya diterjemahkan jadi hasil.
export async function saveProfile(
  userId: string,
  input: Pick<SaveProfileInput, "businessName" | "whatsapp" | "bio" | "slug">,
): Promise<SaveProfileResult> {
  const data = {
    slug: input.slug,
    businessName: input.businessName,
    whatsapp: input.whatsapp,
    bio: input.bio,
  };

  // Dua kali percobaan: kegagalan unik pertama bisa berasal dari kiriman ganda pengguna yang sama
  // (baris owner sudah dibuat); percobaan kedua menjadi pembaruan biasa.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const profile = await db.profile.upsert({
        where: { ownerId: userId },
        create: { ownerId: userId, ...data },
        update: data,
        select: PROFILE_SELECT,
      });
      return { ok: true, profile };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const holder = await db.profile.findUnique({
        where: { slug: input.slug },
        select: { ownerId: true },
      });
      // Slug dipegang orang lain: tolak. Selain itu (milik sendiri / baris owner balapan): ulangi.
      if (holder && holder.ownerId !== userId) return { ok: false, code: "SLUG_TAKEN" };
    }
  }
  throw new Error("saveProfile: gagal setelah percobaan ulang");
}

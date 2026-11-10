import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

// Hanya kolom yang dibutuhkan; `passwordHash` tidak pernah keluar dari lapisan server.
export function findUserForLogin(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
}

export function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, plan: true },
  });
}

// `role` dan `plan` memakai default DB (USER/FREE); tidak pernah dari input pengguna.
export async function createCredentialsUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<{ created: boolean }> {
  try {
    await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
      select: { id: true },
    });
    return { created: true };
  } catch (e) {
    // P2002 = pelanggaran unik (email sudah ada). Dilaporkan sebagai `created: false`, bukan error,
    // supaya pemanggil bisa menjawab sama (anti-enumerasi).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { created: false };
    }
    throw e;
  }
}

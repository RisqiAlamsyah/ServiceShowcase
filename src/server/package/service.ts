import "server-only";
import { db } from "@/lib/db";
import { MAX_ADDONS_PER_PACKAGE, PLAN_LIMITS } from "@/lib/plans";
import type { AddonFields, PackageFields } from "@/lib/validation/package";

// Tipe struktural (bukan `as const`) karena Prisma meminta array yang bisa diubah.
const ORDER: { position?: "asc"; createdAt?: "asc"; id?: "asc" }[] = [
  { position: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
];
// Batas pengaman daftar (RULES §4): paket maksimal 50 per akun, add-on 20 per paket.
const LIST_TAKE = 100;

const PACKAGE_SELECT = {
  id: true,
  title: true,
  description: true,
  basePrice: true,
  position: true,
  createdAt: true,
  addons: {
    select: { id: true, name: true, price: true, position: true },
    orderBy: ORDER,
    take: LIST_TAKE,
  },
} as const;

export type OwnPackage = {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  position: number;
  createdAt: Date;
  addons: { id: string; name: string; price: number; position: number }[];
};

// Kepemilikan ikut di query: semua baca/ubah/hapus menyaring `ownerId` dari sesi (anti-IDOR).
export function listPackagesForUser(userId: string): Promise<OwnPackage[]> {
  return db.servicePackage.findMany({
    where: { ownerId: userId },
    select: PACKAGE_SELECT,
    orderBy: ORDER,
    take: LIST_TAKE,
  });
}

export function getPackageForUser(userId: string, id: string): Promise<OwnPackage | null> {
  return db.servicePackage.findFirst({ where: { id, ownerId: userId }, select: PACKAGE_SELECT });
}

// Tier dibaca dari DB di dalam transaksi (bukan dari sesi/input), setelah kunci advisory per
// pengguna: dua permintaan bersamaan tidak bisa sama-sama lolos cek batas.
async function lockUser(tx: Pick<typeof db, "$executeRaw">, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

export type CreatePackageResult = { ok: true; id: string } | { ok: false; code: "LIMIT_REACHED" };

export function createPackage(userId: string, input: PackageFields): Promise<CreatePackageResult> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const owner = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!owner) return { ok: false, code: "LIMIT_REACHED" } as const;

    const count = await tx.servicePackage.count({ where: { ownerId: userId } });
    if (count >= PLAN_LIMITS[owner.plan].maxPackages)
      return { ok: false, code: "LIMIT_REACHED" } as const;

    const last = await tx.servicePackage.aggregate({
      where: { ownerId: userId },
      _max: { position: true },
    });
    const created = await tx.servicePackage.create({
      data: {
        ownerId: userId, // dari sesi, bukan input
        title: input.title,
        description: input.description,
        basePrice: input.basePrice,
        position: (last._max.position ?? -1) + 1,
      },
      select: { id: true },
    });
    return { ok: true, id: created.id } as const;
  });
}

export async function updatePackage(
  userId: string,
  id: string,
  input: PackageFields,
): Promise<boolean> {
  const { count } = await db.servicePackage.updateMany({
    where: { id, ownerId: userId },
    data: { title: input.title, description: input.description, basePrice: input.basePrice },
  });
  return count === 1;
}

// Add-on ikut terhapus lewat onDelete: Cascade pada relasi paket.
export async function deletePackage(userId: string, id: string): Promise<boolean> {
  const { count } = await db.servicePackage.deleteMany({ where: { id, ownerId: userId } });
  return count === 1;
}

export type CreateAddonResult =
  { ok: true; id: string } | { ok: false; code: "PLAN_REQUIRED" | "NOT_FOUND" | "LIMIT_REACHED" };

export function createAddon(
  userId: string,
  packageId: string,
  input: AddonFields,
): Promise<CreateAddonResult> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const owner = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!owner) return { ok: false, code: "NOT_FOUND" } as const;
    if (!PLAN_LIMITS[owner.plan].addonsAllowed)
      return { ok: false, code: "PLAN_REQUIRED" } as const;

    // Paket harus milik pengguna ini; id paket orang lain diperlakukan sebagai tidak ada.
    const pkg = await tx.servicePackage.findFirst({
      where: { id: packageId, ownerId: userId },
      select: { id: true },
    });
    if (!pkg) return { ok: false, code: "NOT_FOUND" } as const;

    const count = await tx.addon.count({ where: { packageId: pkg.id, ownerId: userId } });
    if (count >= MAX_ADDONS_PER_PACKAGE) return { ok: false, code: "LIMIT_REACHED" } as const;

    const last = await tx.addon.aggregate({
      where: { packageId: pkg.id, ownerId: userId },
      _max: { position: true },
    });
    const created = await tx.addon.create({
      data: {
        ownerId: userId, // disalin dari pemilik paket yang sudah diverifikasi
        packageId: pkg.id,
        name: input.name,
        price: input.price,
        position: (last._max.position ?? -1) + 1,
      },
      select: { id: true },
    });
    return { ok: true, id: created.id } as const;
  });
}

// Mengubah add-on tidak bisa memindahkannya ke paket lain: `packageId` tidak ada di data.
export async function updateAddon(
  userId: string,
  id: string,
  input: AddonFields,
): Promise<boolean> {
  const { count } = await db.addon.updateMany({
    where: { id, ownerId: userId },
    data: { name: input.name, price: input.price },
  });
  return count === 1;
}

export async function deleteAddon(userId: string, id: string): Promise<boolean> {
  const { count } = await db.addon.deleteMany({ where: { id, ownerId: userId } });
  return count === 1;
}

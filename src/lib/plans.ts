// Kebijakan tier (SRS §2). Murni dan tanpa akses DB, sehingga bisa diuji dan dipakai ulang oleh
// dashboard maupun halaman publik. Penegakan sebenarnya ada di service (server), bukan di UI.
export type PlanName = "FREE" | "PRO";

export type PlanLimits = {
  maxPackages: number;
  addonsAllowed: boolean;
};

export const PLAN_LIMITS = {
  FREE: { maxPackages: 2, addonsAllowed: false },
  // Pro "tanpa batas" menurut SRS; angka ini hanya pengaman anti-penyalahgunaan.
  PRO: { maxPackages: 50, addonsAllowed: true },
} as const satisfies Record<PlanName, PlanLimits>;

// Selaras dengan MAX_ADDONS (jumlah add-on per pemesanan) di kalkulator.
export const MAX_ADDONS_PER_PACKAGE = 20;

type Orderable = { id: string; position: number; createdAt: Date };

// Urutan tetap dan deterministik: position, lalu waktu dibuat, lalu id sebagai pemutus seri.
export function sortPackages<T extends Orderable>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.position - b.position ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

// Paket yang tampil di halaman publik: N pertama menurut urutan, N = batas tier. Dihitung saat
// dibaca (tanpa kolom di DB): turun ke Free menyembunyikan sisanya tanpa menghapus apa pun, dan
// naik ke Pro menampilkannya kembali (keputusan user, 10 Nov 2026).
export function publiclyVisiblePackageIds(
  plan: PlanName,
  packages: readonly Orderable[],
): Set<string> {
  const limit = PLAN_LIMITS[plan].maxPackages;
  return new Set(
    sortPackages(packages)
      .slice(0, limit)
      .map((p) => p.id),
  );
}

export function addonsPubliclyVisible(plan: PlanName): boolean {
  return PLAN_LIMITS[plan].addonsAllowed;
}

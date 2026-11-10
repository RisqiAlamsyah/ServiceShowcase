import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

const m = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  servicePackage: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  addon: {
    count: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  // Transaksi memakai objek yang sama sehingga semua pemanggilan terlihat oleh tes.
  db: { ...m, $transaction: async (fn: (tx: typeof m) => unknown) => fn(m) },
}));

const svc = await import("@/server/package/service");

const fields = { title: "Paket Akad", description: "", basePrice: 2_500_000 };
const addonFields = { name: "Hairdo", price: 150_000 };

beforeEach(() => {
  calls.length = 0;
  for (const group of [m.user, m.servicePackage, m.addon]) {
    for (const fn of Object.values(group)) fn.mockReset();
  }
  m.$executeRaw.mockReset().mockImplementation(async () => {
    calls.push("lock");
    return 0;
  });
  m.servicePackage.count.mockImplementation(async () => {
    calls.push("count");
    return 0;
  });
  m.servicePackage.aggregate.mockResolvedValue({ _max: { position: null } });
  m.servicePackage.create.mockResolvedValue({ id: "pkg-baru" });
  m.addon.count.mockResolvedValue(0);
  m.addon.aggregate.mockResolvedValue({ _max: { position: null } });
  m.addon.create.mockResolvedValue({ id: "addon-baru" });
  m.user.findUnique.mockResolvedValue({ plan: "PRO" });
});

describe("baca: kepemilikan ikut di query", () => {
  it("listPackagesForUser menyaring ownerId dan membatasi jumlah", async () => {
    m.servicePackage.findMany.mockResolvedValue([]);
    await svc.listPackagesForUser("user-A");
    const arg = m.servicePackage.findMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ ownerId: "user-A" });
    expect(arg.take).toBeLessThanOrEqual(100);
    expect(arg.select.addons.take).toBeLessThanOrEqual(100);
  });

  it("getPackageForUser menyaring id DAN ownerId (IDOR)", async () => {
    m.servicePackage.findFirst.mockResolvedValue(null);
    expect(await svc.getPackageForUser("user-B", "pkg-milik-A")).toBeNull();
    expect(m.servicePackage.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: "pkg-milik-A",
      ownerId: "user-B",
    });
  });
});

describe("createPackage: batas tier di server", () => {
  it("Free di bawah batas: berhasil, ownerId dari parameter, posisi berurutan", async () => {
    m.user.findUnique.mockResolvedValue({ plan: "FREE" });
    m.servicePackage.count.mockResolvedValue(1);
    m.servicePackage.aggregate.mockResolvedValue({ _max: { position: 4 } });
    const r = await svc.createPackage("user-A", fields);
    expect(r).toEqual({ ok: true, id: "pkg-baru" });
    const data = m.servicePackage.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ ownerId: "user-A", position: 5, basePrice: 2_500_000 });
  });

  it("Free sudah 2 paket: paket ke-3 ditolak dan tidak ditulis", async () => {
    m.user.findUnique.mockResolvedValue({ plan: "FREE" });
    m.servicePackage.count.mockResolvedValue(2);
    expect(await svc.createPackage("user-A", fields)).toEqual({ ok: false, code: "LIMIT_REACHED" });
    expect(m.servicePackage.create).not.toHaveBeenCalled();
  });

  it("Pro boleh lebih dari 2, tetapi tetap ada batas pengaman", async () => {
    m.servicePackage.count.mockResolvedValue(10);
    expect((await svc.createPackage("user-A", fields)).ok).toBe(true);
    m.servicePackage.count.mockResolvedValue(50);
    expect((await svc.createPackage("user-A", fields)).ok).toBe(false);
  });

  it("vendor yang melewati batas setelah turun ke Free tidak bisa menambah", async () => {
    m.user.findUnique.mockResolvedValue({ plan: "FREE" });
    m.servicePackage.count.mockResolvedValue(5);
    expect((await svc.createPackage("user-A", fields)).ok).toBe(false);
  });

  it("kunci advisory diambil SEBELUM menghitung (anti permintaan bersamaan) dan plan dibaca dari DB", async () => {
    await svc.createPackage("user-A", fields);
    expect(calls).toEqual(["lock", "count"]);
    expect(m.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-A" },
      select: { plan: true },
    });
  });

  it("akun yang tidak ada ditolak", async () => {
    m.user.findUnique.mockResolvedValue(null);
    expect((await svc.createPackage("hantu", fields)).ok).toBe(false);
    expect(m.servicePackage.create).not.toHaveBeenCalled();
  });
});

describe("updatePackage / deletePackage: IDOR", () => {
  it("update menyaring id + ownerId; true hanya bila tepat satu baris berubah", async () => {
    m.servicePackage.updateMany.mockResolvedValue({ count: 1 });
    expect(await svc.updatePackage("user-A", "pkg-1", fields)).toBe(true);
    const arg = m.servicePackage.updateMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ id: "pkg-1", ownerId: "user-A" });
    expect(Object.keys(arg.data).sort()).toEqual(["basePrice", "description", "title"]);
  });

  it("pengguna B mengubah paket milik A: tidak ada baris berubah (false)", async () => {
    m.servicePackage.updateMany.mockResolvedValue({ count: 0 });
    expect(await svc.updatePackage("user-B", "pkg-milik-A", fields)).toBe(false);
    expect(m.servicePackage.updateMany.mock.calls[0]?.[0].where.ownerId).toBe("user-B");
  });

  it("delete menyaring id + ownerId dan melaporkan hasilnya", async () => {
    m.servicePackage.deleteMany.mockResolvedValue({ count: 0 });
    expect(await svc.deletePackage("user-B", "pkg-milik-A")).toBe(false);
    expect(m.servicePackage.deleteMany.mock.calls[0]?.[0].where).toEqual({
      id: "pkg-milik-A",
      ownerId: "user-B",
    });
    m.servicePackage.deleteMany.mockResolvedValue({ count: 1 });
    expect(await svc.deletePackage("user-A", "pkg-1")).toBe(true);
  });
});

describe("createAddon", () => {
  beforeEach(() => {
    m.servicePackage.findFirst.mockResolvedValue({ id: "pkg-1" });
  });

  it("Pro: berhasil; ownerId dan packageId berasal dari paket yang diverifikasi", async () => {
    const r = await svc.createAddon("user-A", "pkg-1", addonFields);
    expect(r).toEqual({ ok: true, id: "addon-baru" });
    expect(m.addon.create.mock.calls[0]?.[0].data).toMatchObject({
      ownerId: "user-A",
      packageId: "pkg-1",
      position: 0,
    });
  });

  it("Free: ditolak di server (PLAN_REQUIRED) tanpa menyentuh paket", async () => {
    m.user.findUnique.mockResolvedValue({ plan: "FREE" });
    expect(await svc.createAddon("user-A", "pkg-1", addonFields)).toEqual({
      ok: false,
      code: "PLAN_REQUIRED",
    });
    expect(m.servicePackage.findFirst).not.toHaveBeenCalled();
    expect(m.addon.create).not.toHaveBeenCalled();
  });

  it("IDOR: menaruh add-on di paket milik orang lain menghasilkan NOT_FOUND", async () => {
    m.servicePackage.findFirst.mockResolvedValue(null);
    expect(await svc.createAddon("user-B", "pkg-milik-A", addonFields)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(m.servicePackage.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: "pkg-milik-A",
      ownerId: "user-B",
    });
    expect(m.addon.create).not.toHaveBeenCalled();
  });

  it("batas 20 add-on per paket", async () => {
    m.addon.count.mockResolvedValue(20);
    expect(await svc.createAddon("user-A", "pkg-1", addonFields)).toEqual({
      ok: false,
      code: "LIMIT_REACHED",
    });
    expect(m.addon.create).not.toHaveBeenCalled();
  });

  it("memakai kunci advisory sebelum cek", async () => {
    await svc.createAddon("user-A", "pkg-1", addonFields);
    expect(calls[0]).toBe("lock");
  });
});

describe("updateAddon / deleteAddon: IDOR", () => {
  it("update tidak bisa memindahkan paket dan menyaring ownerId", async () => {
    m.addon.updateMany.mockResolvedValue({ count: 1 });
    expect(await svc.updateAddon("user-A", "add-1", addonFields)).toBe(true);
    const arg = m.addon.updateMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ id: "add-1", ownerId: "user-A" });
    expect(Object.keys(arg.data).sort()).toEqual(["name", "price"]);
  });

  it("pengguna B tidak bisa mengubah atau menghapus add-on milik A", async () => {
    m.addon.updateMany.mockResolvedValue({ count: 0 });
    m.addon.deleteMany.mockResolvedValue({ count: 0 });
    expect(await svc.updateAddon("user-B", "add-milik-A", addonFields)).toBe(false);
    expect(await svc.deleteAddon("user-B", "add-milik-A")).toBe(false);
    expect(m.addon.deleteMany.mock.calls[0]?.[0].where).toEqual({
      id: "add-milik-A",
      ownerId: "user-B",
    });
  });
});

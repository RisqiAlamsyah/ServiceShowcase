import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  consume: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  createAddon: vi.fn(),
  updateAddon: vi.fn(),
  deleteAddon: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/server/auth/guards", () => {
  class AuthError extends Error {
    constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
      super(code);
    }
  }
  return { AuthError, requireUser: m.requireUser };
});
vi.mock("@/server/auth/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/server/auth/rate-limit")>()),
  consume: m.consume,
}));
vi.mock("@/server/package/service", () => ({
  createPackage: m.createPackage,
  updatePackage: m.updatePackage,
  deletePackage: m.deletePackage,
  createAddon: m.createAddon,
  updateAddon: m.updateAddon,
  deleteAddon: m.deleteAddon,
}));
vi.mock("@/lib/db", () => ({ db: {} }));

const actions = await import("@/actions/package");
const { AuthError } = await import("@/server/auth/guards");

const ID = "clh3am9gn0000a6lxg5c8k1zq";
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const pkgForm = { title: "Paket Akad", description: "", basePrice: "2.500.000" };
const addonForm = { name: "Hairdo", price: "150.000" };

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  m.requireUser.mockResolvedValue({ id: "user-A", plan: "FREE" });
  m.consume.mockResolvedValue(true);
  m.createPackage.mockResolvedValue({ ok: true, id: ID });
  m.updatePackage.mockResolvedValue(true);
  m.deletePackage.mockResolvedValue(true);
  m.createAddon.mockResolvedValue({ ok: true, id: ID });
  m.updateAddon.mockResolvedValue(true);
  m.deleteAddon.mockResolvedValue(true);
});

describe("semua action: akses", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["createPackage", () => actions.createPackageAction(null, form(pkgForm))],
    ["updatePackage", () => actions.updatePackageAction(null, form({ ...pkgForm, id: ID }))],
    ["deletePackage", () => actions.deletePackageAction(null, form({ id: ID }))],
    ["createAddon", () => actions.createAddonAction(null, form({ ...addonForm, packageId: ID }))],
    ["updateAddon", () => actions.updateAddonAction(null, form({ ...addonForm, id: ID }))],
    ["deleteAddon", () => actions.deleteAddonAction(null, form({ id: ID }))],
  ];

  it.each(cases)(
    "%s: tanpa login ditolak (UNAUTHENTICATED) tanpa menyentuh service",
    async (_n, run) => {
      m.requireUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));
      expect(await run()).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
      expect(m.consume).not.toHaveBeenCalled();
      for (const fn of [
        m.createPackage,
        m.updatePackage,
        m.deletePackage,
        m.createAddon,
        m.updateAddon,
        m.deleteAddon,
      ]) {
        expect(fn).not.toHaveBeenCalled();
      }
    },
  );

  it.each(cases)("%s: ditolak saat batas tulis terlampaui (RATE_LIMITED)", async (_n, run) => {
    m.consume.mockResolvedValue(false);
    expect(await run()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    for (const fn of [
      m.createPackage,
      m.updatePackage,
      m.deletePackage,
      m.createAddon,
      m.updateAddon,
      m.deleteAddon,
    ]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(cases)("%s: kegagalan DB menghasilkan pesan generik tanpa detail", async (_n, run) => {
    for (const fn of [
      m.createPackage,
      m.updatePackage,
      m.deletePackage,
      m.createAddon,
      m.updateAddon,
      m.deleteAddon,
    ]) {
      fn.mockRejectedValue(new Error("detail-internal-db"));
    }
    const r = await run();
    expect(r).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(r)).not.toContain("detail-internal-db");
  });
});

describe("createPackageAction", () => {
  it("berhasil: ownerId dari sesi, harga bilangan bulat, revalidasi tepat sasaran", async () => {
    const r = await actions.createPackageAction(null, form({ ...pkgForm, ownerId: "user-B" }));
    expect(r?.ok).toBe(true);
    expect(m.createPackage).toHaveBeenCalledWith("user-A", {
      title: "Paket Akad",
      description: "",
      basePrice: 2_500_000,
    });
    expect(m.revalidatePath).toHaveBeenCalledWith("/dashboard/paket");
  });

  it("input tidak valid: VALIDATION per kolom, isian dikembalikan, tidak menulis", async () => {
    const r = await actions.createPackageAction(null, form({ title: "A", basePrice: "gratis" }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r && !r.ok && Object.keys(r.fieldErrors ?? {}).sort()).toEqual(["basePrice", "title"]);
    expect(r && !r.ok && r.values?.basePrice).toBe("gratis");
    expect(m.createPackage).not.toHaveBeenCalled();
  });

  it("batas Free tercapai: FORBIDDEN dengan pesan jelas", async () => {
    m.createPackage.mockResolvedValue({ ok: false, code: "LIMIT_REACHED" });
    const r = await actions.createPackageAction(null, form(pkgForm));
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(r && !r.ok && r.message).toMatch(/Batas paket tercapai/);
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updatePackageAction / deletePackageAction: IDOR", () => {
  it("update paket milik orang lain: NOT_FOUND (bukan FORBIDDEN)", async () => {
    m.updatePackage.mockResolvedValue(false);
    const r = await actions.updatePackageAction(null, form({ ...pkgForm, id: ID }));
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(m.updatePackage.mock.calls[0]?.[0]).toBe("user-A");
  });

  it("update berhasil mengembalikan nilai tersimpan", async () => {
    const r = await actions.updatePackageAction(null, form({ ...pkgForm, id: ID }));
    expect(r && r.ok && r.values).toEqual({
      title: "Paket Akad",
      description: "",
      basePrice: "2500000",
    });
  });

  it("id bukan cuid ditolak sebelum menyentuh service", async () => {
    const r = await actions.updatePackageAction(null, form({ ...pkgForm, id: "' OR 1=1 --" }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(m.updatePackage).not.toHaveBeenCalled();
  });

  it("hapus paket berhasil: mengarahkan ke daftar paket", async () => {
    await expect(actions.deletePackageAction(null, form({ id: ID }))).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/paket",
    );
    expect(m.deletePackage).toHaveBeenCalledWith("user-A", ID);
  });

  it("hapus paket milik orang lain: NOT_FOUND tanpa redirect", async () => {
    m.deletePackage.mockResolvedValue(false);
    const r = await actions.deletePackageAction(null, form({ id: ID }));
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("hapus dengan id tidak valid: NOT_FOUND", async () => {
    const r = await actions.deletePackageAction(null, form({ id: "bukan-cuid" }));
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(m.deletePackage).not.toHaveBeenCalled();
  });
});

describe("add-on actions", () => {
  it("tambah add-on berhasil memakai userId sesi dan packageId dari form", async () => {
    const r = await actions.createAddonAction(null, form({ ...addonForm, packageId: ID }));
    expect(r?.ok).toBe(true);
    expect(m.createAddon).toHaveBeenCalledWith("user-A", ID, { name: "Hairdo", price: 150_000 });
  });

  it("Free: pesan 'tersedia di Pro' (FORBIDDEN)", async () => {
    m.createAddon.mockResolvedValue({ ok: false, code: "PLAN_REQUIRED" });
    const r = await actions.createAddonAction(null, form({ ...addonForm, packageId: ID }));
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(r && !r.ok && r.message).toBe("Add-on tersedia di paket Pro.");
  });

  it("IDOR: paket milik orang lain menghasilkan NOT_FOUND", async () => {
    m.createAddon.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const r = await actions.createAddonAction(null, form({ ...addonForm, packageId: ID }));
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("batas per paket: FORBIDDEN dengan pesan batas", async () => {
    m.createAddon.mockResolvedValue({ ok: false, code: "LIMIT_REACHED" });
    const r = await actions.createAddonAction(null, form({ ...addonForm, packageId: ID }));
    expect(r && !r.ok && r.message).toMatch(/Batas add-on/);
  });

  it("ubah add-on: packageId di form diabaikan/ditolak (tidak bisa pindah paket)", async () => {
    const r = await actions.updateAddonAction(null, form({ ...addonForm, id: ID, packageId: "x" }));
    // packageId tidak dibaca sama sekali, jadi tidak pernah sampai ke service
    expect(r?.ok).toBe(true);
    expect(m.updateAddon).toHaveBeenCalledWith("user-A", ID, { name: "Hairdo", price: 150_000 });
  });

  it("ubah/hapus add-on milik orang lain: NOT_FOUND", async () => {
    m.updateAddon.mockResolvedValue(false);
    m.deleteAddon.mockResolvedValue(false);
    expect(await actions.updateAddonAction(null, form({ ...addonForm, id: ID }))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await actions.deleteAddonAction(null, form({ id: ID }))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("harga add-on tidak valid ditolak per kolom", async () => {
    const r = await actions.createAddonAction(
      null,
      form({ name: "Hairdo", price: "-1", packageId: ID }),
    );
    expect(r && !r.ok && r.fieldErrors?.price).toBeTruthy();
    expect(m.createAddon).not.toHaveBeenCalled();
  });
});

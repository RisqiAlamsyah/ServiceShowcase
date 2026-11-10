import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  consume: vi.fn(),
  getProfileForUser: vi.fn(),
  saveProfile: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/auth/guards", () => {
  class AuthError extends Error {
    constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
      super(code);
    }
  }
  return { AuthError, requireUser: mocks.requireUser };
});
vi.mock("@/server/auth/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/server/auth/rate-limit")>()),
  consume: mocks.consume,
}));
vi.mock("@/server/profile/service", () => ({
  getProfileForUser: mocks.getProfileForUser,
  saveProfile: mocks.saveProfile,
}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { saveProfileAction } = await import("@/actions/profile");
const { AuthError } = await import("@/server/auth/guards");

const userA = { id: "user-A", email: "a@b.co", name: "A", role: "USER", plan: "FREE" };

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const good = {
  businessName: "Dewi MUA",
  whatsapp: "08123456789",
  bio: "Halo",
  slug: "dewi-mua",
};

const saved = { slug: "dewi-mua", businessName: "Dewi MUA", whatsapp: "628123456789", bio: "Halo" };

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue(userA);
  mocks.consume.mockReset().mockResolvedValue(true);
  mocks.getProfileForUser.mockReset().mockResolvedValue(null);
  mocks.saveProfile.mockReset().mockResolvedValue({ ok: true, profile: saved });
  mocks.revalidatePath.mockReset();
});

describe("saveProfileAction: akses", () => {
  it("menolak tanpa login (UNAUTHENTICATED) tanpa menyentuh DB atau rate limit", async () => {
    mocks.requireUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.getProfileForUser).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("ownerId selalu dari sesi: field ownerId/userId di form diabaikan", async () => {
    await saveProfileAction(null, form({ ...good, ownerId: "user-B", userId: "user-B" }));
    expect(mocks.saveProfile).toHaveBeenCalledTimes(1);
    expect(mocks.saveProfile.mock.calls[0]?.[0]).toBe("user-A");
    expect(mocks.getProfileForUser).toHaveBeenCalledWith("user-A");
  });

  it("IDOR: pengguna B hanya membaca dan menyimpan profil miliknya", async () => {
    mocks.requireUser.mockResolvedValue({ ...userA, id: "user-B" });
    await saveProfileAction(null, form(good));
    expect(mocks.getProfileForUser).toHaveBeenCalledWith("user-B");
    expect(mocks.saveProfile.mock.calls[0]?.[0]).toBe("user-B");
  });

  it("ditolak saat batas tulis terlampaui", async () => {
    mocks.consume.mockResolvedValue(false);
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});

describe("saveProfileAction: berhasil", () => {
  it("membuat profil pertama: tanpa konfirmasi/batas slug, revalidasi tepat sasaran", async () => {
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: true, data: { slug: "dewi-mua" } });
    // hanya satu pemakaian batas (tulis); batas ganti slug tidak dipakai untuk profil baru
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.consume.mock.calls[0]?.[0]).toBe("profile:write");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/profil");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("menyimpan nomor yang sudah dinormalkan dan mengembalikan nilai tersimpan", async () => {
    const r = await saveProfileAction(null, form(good));
    expect(mocks.saveProfile.mock.calls[0]?.[1]).toMatchObject({ whatsapp: "628123456789" });
    expect(r && r.ok && r.values).toMatchObject({ whatsapp: "628123456789", slug: "dewi-mua" });
  });

  it("memperbarui profil tanpa mengganti slug: tanpa konfirmasi dan tanpa batas slug", async () => {
    mocks.getProfileForUser.mockResolvedValue({ ...saved });
    const r = await saveProfileAction(null, form({ ...good, businessName: "Dewi Studio" }));
    expect(r?.ok).toBe(true);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
  });
});

describe("saveProfileAction: validasi", () => {
  it("input tidak valid: VALIDATION per kolom, isian dikembalikan, tidak menyimpan", async () => {
    const r = await saveProfileAction(
      null,
      form({ ...good, whatsapp: "abc", slug: "Admin", businessName: "A" }),
    );
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r && !r.ok && Object.keys(r.fieldErrors ?? {}).sort()).toEqual([
      "businessName",
      "slug",
      "whatsapp",
    ]);
    expect(r && !r.ok && r.values).toMatchObject({ whatsapp: "abc", slug: "Admin" });
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("slug terlarang ditolak", async () => {
    const r = await saveProfileAction(null, form({ ...good, slug: "dashboard" }));
    expect(r && !r.ok && r.fieldErrors?.slug).toBeTruthy();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});

describe("saveProfileAction: mengganti slug (opsi B)", () => {
  const existing = { ...saved, slug: "slug-lama" };

  it("tanpa konfirmasi: ditolak dan tidak memakai batas harian", async () => {
    mocks.getProfileForUser.mockResolvedValue(existing);
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r && !r.ok && r.fieldErrors?.confirmSlugChange).toBeTruthy();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
    expect(mocks.consume.mock.calls.map((c) => c[0])).toEqual(["profile:write"]);
  });

  it("dengan konfirmasi: berhasil dan memakai batas harian", async () => {
    mocks.getProfileForUser.mockResolvedValue(existing);
    const r = await saveProfileAction(null, form({ ...good, confirmSlugChange: "on" }));
    expect(r?.ok).toBe(true);
    expect(mocks.consume.mock.calls.map((c) => c[0])).toEqual(["profile:write", "profile:slug"]);
  });

  it("batas 3 kali per hari terlampaui: RATE_LIMITED dan tidak menyimpan", async () => {
    mocks.getProfileForUser.mockResolvedValue(existing);
    mocks.consume.mockImplementation(async (scope: string) => scope !== "profile:slug");
    const r = await saveProfileAction(null, form({ ...good, confirmSlugChange: "on" }));
    expect(r).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("konfirmasi dengan nilai selain 'on' ditolak", async () => {
    mocks.getProfileForUser.mockResolvedValue(existing);
    const r = await saveProfileAction(null, form({ ...good, confirmSlugChange: "true" }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("saveProfileAction: konflik dan galat", () => {
  it("slug sudah dipakai: CONFLICT pada kolom slug, isian dikembalikan", async () => {
    mocks.saveProfile.mockResolvedValue({ ok: false, code: "SLUG_TAKEN" });
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(r && !r.ok && r.fieldErrors?.slug?.[0]).toMatch(/sudah dipakai/);
    expect(r && !r.ok && r.values?.businessName).toBe("Dewi MUA");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("kegagalan DB menghasilkan pesan generik tanpa detail", async () => {
    mocks.saveProfile.mockRejectedValue(new Error("detail-internal-db"));
    const r = await saveProfileAction(null, form(good));
    expect(r).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(r)).not.toContain("detail-internal-db");
  });
});

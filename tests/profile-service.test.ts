import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db", () => ({ db: { profile: { findUnique, upsert } } }));

const { getProfileForUser, saveProfile } = await import("@/server/profile/service");

const input = {
  businessName: "Dewi MUA",
  whatsapp: "6281234567890",
  bio: null,
  slug: "dewi-mua",
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
});

describe("getProfileForUser", () => {
  it("mencari profil berdasarkan ownerId (kepemilikan ikut di query)", async () => {
    findUnique.mockResolvedValue(null);
    await getProfileForUser("user-A");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-A" } }),
    );
  });

  it("memilih kolom eksplisit (tanpa id/ownerId)", async () => {
    findUnique.mockResolvedValue(null);
    await getProfileForUser("user-A");
    const arg = findUnique.mock.calls[0]?.[0];
    expect(Object.keys(arg.select).sort()).toEqual(["bio", "businessName", "slug", "whatsapp"]);
  });
});

describe("saveProfile", () => {
  it("berhasil: ownerId dari parameter, hanya field yang diizinkan", async () => {
    upsert.mockResolvedValue({ ...input });
    const r = await saveProfile("user-A", input);
    expect(r.ok).toBe(true);
    const arg = upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ ownerId: "user-A" });
    expect(arg.create.ownerId).toBe("user-A");
    expect(arg.update).not.toHaveProperty("ownerId");
    expect(Object.keys(arg.update).sort()).toEqual(["bio", "businessName", "slug", "whatsapp"]);
  });

  it("IDOR: pengguna B menyimpan hanya ke barisnya sendiri", async () => {
    upsert.mockResolvedValue({ ...input });
    await saveProfile("user-B", input);
    expect(upsert.mock.calls[0]?.[0].where).toEqual({ ownerId: "user-B" });
  });

  it("slug dipakai pengguna lain: SLUG_TAKEN", async () => {
    upsert.mockRejectedValue(uniqueViolation());
    findUnique.mockResolvedValue({ ownerId: "user-lain" });
    expect(await saveProfile("user-A", input)).toEqual({ ok: false, code: "SLUG_TAKEN" });
  });

  it("kiriman ganda (baris owner sudah ada): percobaan kedua berhasil", async () => {
    upsert.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce({ ...input });
    findUnique.mockResolvedValue(null);
    const r = await saveProfile("user-A", input);
    expect(r.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("slug milik sendiri saat balapan tidak dianggap bentrok", async () => {
    upsert.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce({ ...input });
    findUnique.mockResolvedValue({ ownerId: "user-A" });
    expect((await saveProfile("user-A", input)).ok).toBe(true);
  });

  it("error DB lain diteruskan (tidak ditelan sebagai SLUG_TAKEN)", async () => {
    upsert.mockRejectedValue(new Error("db down"));
    await expect(saveProfile("user-A", input)).rejects.toThrow("db down");
  });

  it("berhenti dengan error bila tetap gagal unik setelah dua percobaan", async () => {
    upsert.mockRejectedValue(uniqueViolation());
    findUnique.mockResolvedValue(null);
    await expect(saveProfile("user-A", input)).rejects.toThrow();
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("menghasilkan Argon2id dan memverifikasi sandi yang benar", async () => {
    const hash = await hashPassword("kalimat-sandi-panjang-9");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("kalimat-sandi-panjang-9");
    expect(await verifyPassword(hash, "kalimat-sandi-panjang-9")).toBe(true);
  });

  it("menolak sandi yang salah", async () => {
    const hash = await hashPassword("kalimat-sandi-panjang-9");
    expect(await verifyPassword(hash, "kalimat-sandi-panjang-8")).toBe(false);
  });

  it("memakai salt acak: hash sandi sama berbeda", async () => {
    const [a, b] = await Promise.all([
      hashPassword("sandi-yang-sama-12"),
      hashPassword("sandi-yang-sama-12"),
    ]);
    expect(a).not.toBe(b);
  });

  it("menganggap hash rusak sebagai gagal, bukan error", async () => {
    expect(await verifyPassword("bukan-hash", "apa-saja")).toBe(false);
  });

  it("verifyAgainstDummy selalu false", async () => {
    expect(await verifyAgainstDummy("apa-saja")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "@/lib/env.schema";

describe("parseClientEnv", () => {
  it("menerima URL situs yang valid", () => {
    const env = parseClientEnv({ NEXT_PUBLIC_SITE_URL: "https://serviceshowcase.example" });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://serviceshowcase.example");
  });

  it("menolak variabel yang hilang dan hanya menyebut nama, bukan nilai", () => {
    expect(() => parseClientEnv({})).toThrowError(/NEXT_PUBLIC_SITE_URL/);
  });

  it("menolak URL yang tidak valid atau berakhiran garis miring", () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_SITE_URL: "bukan-url" })).toThrow();
    expect(() => parseClientEnv({ NEXT_PUBLIC_SITE_URL: "https://x.example/" })).toThrow();
  });

  it("tidak membocorkan nilai rahasia di pesan error", () => {
    try {
      parseClientEnv({ NEXT_PUBLIC_SITE_URL: "rahasia-ini-bukan-url" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain("rahasia-ini-bukan-url");
    }
  });
});

describe("parseServerEnv", () => {
  const DB = "postgresql://user:password@localhost:5432/db?sslmode=require";

  it("memakai default development bila NODE_ENV kosong", () => {
    expect(parseServerEnv({ DATABASE_URL: DB }).NODE_ENV).toBe("development");
  });

  it("menolak NODE_ENV di luar daftar", () => {
    expect(() => parseServerEnv({ NODE_ENV: "staging", DATABASE_URL: DB })).toThrowError(
      /NODE_ENV/,
    );
  });

  it("menerima URL PostgreSQL", () => {
    expect(parseServerEnv({ DATABASE_URL: DB }).DATABASE_URL).toBe(DB);
  });

  it("menolak DATABASE_URL yang hilang atau bukan PostgreSQL", () => {
    expect(() => parseServerEnv({})).toThrowError(/DATABASE_URL/);
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://u:p@h/db" })).toThrowError(/DATABASE_URL/);
  });

  it("tidak membocorkan isi DATABASE_URL di pesan error", () => {
    try {
      parseServerEnv({ DATABASE_URL: "mysql://pengguna:sandi-rahasia@host/db" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain("sandi-rahasia");
    }
  });
});

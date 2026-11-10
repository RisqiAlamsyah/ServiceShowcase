import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { $queryRaw: queryRaw, rateLimitBucket: { deleteMany: vi.fn().mockResolvedValue({}) } },
}));

const { RATE_RULES, bucketKey, clientIp, consume } = await import("@/server/auth/rate-limit");

beforeEach(() => {
  // Tanpa return: fungsi yang dikembalikan beforeEach dianggap teardown oleh Vitest.
  queryRaw.mockReset();
});

describe("consume", () => {
  it("mengizinkan selama hitungan <= batas", async () => {
    queryRaw.mockResolvedValue([{ count: RATE_RULES.loginEmail.max }]);
    expect(await consume("login:email", "a@b.co", RATE_RULES.loginEmail)).toBe(true);
  });

  it("menolak saat hitungan melewati batas", async () => {
    queryRaw.mockResolvedValue([{ count: RATE_RULES.loginEmail.max + 1 }]);
    expect(await consume("login:email", "a@b.co", RATE_RULES.loginEmail)).toBe(false);
  });

  it("menolak (gagal tertutup) bila DB tidak mengembalikan baris", async () => {
    queryRaw.mockResolvedValue([]);
    expect(await consume("login:ip", "1.2.3.4", RATE_RULES.loginIp)).toBe(false);
  });

  it("meneruskan error DB (tidak diam-diam mengizinkan)", async () => {
    queryRaw.mockImplementation(() => {
      throw new Error("db down");
    });
    const outcome = await consume("login:ip", "1.2.3.4", RATE_RULES.loginIp).then(
      () => "resolved",
      (e: unknown) => String(e),
    );
    expect(outcome).toContain("db down");
  });
});

describe("bucketKey", () => {
  it("tidak memuat identitas mentah dan tidak peka huruf besar/kecil", () => {
    const key = bucketKey("login:email", "Dewi@Example.com");
    expect(key).not.toContain("dewi");
    expect(key).not.toContain("example");
    expect(key).toBe(bucketKey("login:email", "dewi@example.com"));
    expect(key).not.toBe(bucketKey("login:ip", "dewi@example.com"));
  });
});

describe("clientIp", () => {
  it("memakai x-real-ip, lalu x-forwarded-for pertama, lalu unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe(
      "9.9.9.9",
    );
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

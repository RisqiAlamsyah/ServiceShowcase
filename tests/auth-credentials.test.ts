import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/server/auth/password";

const consume = vi.fn();
const findUserForLogin = vi.fn();

vi.mock("@/server/auth/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/server/auth/rate-limit")>()),
  consume,
}));
vi.mock("@/server/user/service", () => ({ findUserForLogin }));
vi.mock("@/lib/db", () => ({ db: {} }));

const { authorizeCredentials } = await import("@/server/auth/credentials");

const PW = "kalimat-sandi-panjang-9"; // sec-ok: sandi fiktif untuk fixture tes, bukan rahasia
const headers = new Headers({ "x-real-ip": "1.2.3.4" });

beforeEach(() => {
  consume.mockReset().mockResolvedValue(true);
  findUserForLogin.mockReset();
});

describe("authorizeCredentials", () => {
  it("berhasil dan mengabaikan field ekstra dari Auth.js (callbackUrl, csrfToken)", async () => {
    const passwordHash = await hashPassword(PW);
    findUserForLogin.mockResolvedValue({ id: "u1", email: "a@b.co", name: "A", passwordHash });

    const user = await authorizeCredentials(
      { email: "A@B.co", password: PW, callbackUrl: "http://x/dashboard", csrfToken: "t" },
      headers,
    );

    expect(user).toEqual({ id: "u1", email: "a@b.co", name: "A" });
    expect(user).not.toHaveProperty("passwordHash");
    expect(findUserForLogin).toHaveBeenCalledWith("a@b.co");
  });

  it("sandi salah menghasilkan null", async () => {
    const passwordHash = await hashPassword(PW);
    findUserForLogin.mockResolvedValue({ id: "u1", email: "a@b.co", name: "A", passwordHash });
    expect(await authorizeCredentials({ email: "a@b.co", password: PW + "x" }, headers)).toBeNull();
  });

  it("email tidak terdaftar menghasilkan null", async () => {
    findUserForLogin.mockResolvedValue(null);
    expect(await authorizeCredentials({ email: "a@b.co", password: PW }, headers)).toBeNull();
  });

  it("akun tanpa sandi (mis. SSO) tidak bisa masuk dengan sandi apa pun", async () => {
    findUserForLogin.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      name: "A",
      passwordHash: null,
    });
    expect(await authorizeCredentials({ email: "a@b.co", password: PW }, headers)).toBeNull();
  });

  it("input tidak valid menghasilkan null tanpa menyentuh DB atau rate limit", async () => {
    expect(await authorizeCredentials({ email: "bukan-email", password: PW }, headers)).toBeNull();
    expect(await authorizeCredentials({ email: "a@b.co" }, headers)).toBeNull();
    expect(consume).not.toHaveBeenCalled();
    expect(findUserForLogin).not.toHaveBeenCalled();
  });

  it("ditolak saat rate limit terlampaui, bahkan dengan sandi benar (akses ditolak)", async () => {
    const passwordHash = await hashPassword(PW);
    findUserForLogin.mockResolvedValue({ id: "u1", email: "a@b.co", name: "A", passwordHash });
    consume.mockResolvedValue(false);
    expect(await authorizeCredentials({ email: "a@b.co", password: PW }, headers)).toBeNull();
    expect(findUserForLogin).not.toHaveBeenCalled();
  });
});

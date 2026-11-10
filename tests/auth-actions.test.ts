import { beforeEach, describe, expect, it, vi } from "vitest";

const consume = vi.fn();
const createCredentialsUser = vi.fn();
const signIn = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

class FakeAuthError extends Error {}

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth", () => ({ AuthError: FakeAuthError }));
vi.mock("@/auth", () => ({ signIn, signOut: vi.fn() }));
vi.mock("@/server/auth/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/server/auth/rate-limit")>()),
  consume,
}));
vi.mock("@/server/user/service", () => ({ createCredentialsUser }));
vi.mock("@/lib/db", () => ({ db: {} }));

const { registerAction, loginAction } = await import("@/actions/auth");

const PW = "kalimat-sandi-panjang-9"; // sec-ok: sandi fiktif untuk fixture tes, bukan rahasia

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const goodRegister = {
  name: "Dewi Lestari",
  email: "dewi@example.com",
  password: PW,
  confirmPassword: PW,
};

beforeEach(() => {
  consume.mockReset().mockResolvedValue(true);
  createCredentialsUser.mockReset().mockResolvedValue({ created: true });
  signIn.mockReset();
  redirect.mockClear();
});

describe("registerAction", () => {
  it("berhasil: menyimpan hash Argon2id (bukan sandi) lalu mengarahkan ke /masuk", async () => {
    await expect(registerAction(null, form(goodRegister))).rejects.toThrow(
      "NEXT_REDIRECT:/masuk?daftar=1",
    );
    const arg = createCredentialsUser.mock.calls[0]?.[0];
    expect(arg.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(JSON.stringify(arg)).not.toContain(PW);
    // role/plan tidak pernah dikirim dari action
    expect(arg).not.toHaveProperty("role");
    expect(arg).not.toHaveProperty("plan");
  });

  it("anti-enumerasi: email sudah terdaftar menghasilkan jalur yang sama persis", async () => {
    createCredentialsUser.mockResolvedValue({ created: false });
    await expect(registerAction(null, form(goodRegister))).rejects.toThrow(
      "NEXT_REDIRECT:/masuk?daftar=1",
    );
  });

  it("input tidak valid: VALIDATION per kolom, tanpa menyentuh DB atau rate limit", async () => {
    const r = await registerAction(null, form({ ...goodRegister, password: "pendek" }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r && !r.ok && r.fieldErrors?.password).toBeTruthy();
    expect(createCredentialsUser).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
  });

  it("field asing (role) diabaikan: user tidak pernah menerima role dari input", async () => {
    const f = form(goodRegister);
    f.set("role", "ADMIN");
    await expect(registerAction(null, f)).rejects.toThrow("NEXT_REDIRECT");
    expect(createCredentialsUser.mock.calls[0]?.[0]).not.toHaveProperty("role");
  });

  it("ditolak saat rate limit terlampaui (akses ditolak)", async () => {
    consume.mockResolvedValue(false);
    const r = await registerAction(null, form(goodRegister));
    expect(r).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(createCredentialsUser).not.toHaveBeenCalled();
  });

  it("kegagalan DB menghasilkan pesan generik tanpa detail", async () => {
    createCredentialsUser.mockRejectedValue(new Error("detail-internal-db"));
    const r = await registerAction(null, form(goodRegister));
    expect(r).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(r)).not.toContain("detail-internal-db");
  });
});

describe("loginAction", () => {
  const creds = { email: "Dewi@Example.com", password: PW };

  it("berhasil: meneruskan email ternormalisasi dan redirect aman", async () => {
    signIn.mockResolvedValue(undefined);
    await loginAction(null, form({ ...creds, next: "/dashboard/paket" }));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "dewi@example.com",
      password: PW,
      redirectTo: "/dashboard/paket",
    });
  });

  it("redirect berbahaya jatuh ke /dashboard (open redirect)", async () => {
    signIn.mockResolvedValue(undefined);
    await loginAction(null, form({ ...creds, next: "https://jahat.example" }));
    expect(signIn.mock.calls[0]?.[1]).toMatchObject({ redirectTo: "/dashboard" });
  });

  it("kredensial salah: pesan generik UNAUTHENTICATED", async () => {
    signIn.mockRejectedValue(new FakeAuthError("CredentialsSignin"));
    const r = await loginAction(null, form(creds));
    expect(r).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(r && !r.ok && r.message).not.toMatch(/tidak terdaftar|tidak ditemukan/i);
  });

  it("input tidak valid: VALIDATION tanpa memanggil signIn", async () => {
    const r = await loginAction(null, form({ email: "bukan-email", password: "x" }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("meneruskan redirect sukses (error non-AuthError tidak ditelan)", async () => {
    signIn.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(loginAction(null, form(creds))).rejects.toThrow("NEXT_REDIRECT");
  });
});

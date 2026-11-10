import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

const PW = "kalimat-sandi-panjang-9"; // sec-ok: sandi fiktif untuk fixture tes, bukan rahasia

const valid = {
  name: "Dewi Lestari",
  email: "  Dewi@Example.COM ",
  password: PW,
  confirmPassword: PW,
};

function withPassword(password: string) {
  return { ...valid, password, confirmPassword: password };
}

describe("registerSchema", () => {
  it("menerima input valid dan menormalkan email", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("dewi@example.com");
  });

  it.each(["pendek", "password1234", "Password1234", "aaaaaaaaaaaaaaaa"])(
    "menolak sandi pendek, umum, atau monoton: %s",
    (password) => {
      expect(registerSchema.safeParse(withPassword(password)).success).toBe(false);
    },
  );

  it("menolak sandi lebih dari 128 karakter", () => {
    expect(registerSchema.safeParse(withPassword("k".repeat(129) + "abc")).success).toBe(false);
  });

  it("menolak konfirmasi yang tidak sama", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: PW + "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.confirmPassword).toBeTruthy();
  });

  it("menolak sandi yang sama dengan email", () => {
    const email = "dewi.lestari@example.com";
    expect(registerSchema.safeParse({ ...withPassword(email), email }).success).toBe(false);
  });

  it("menolak email tidak valid dan nama berbahaya", () => {
    expect(registerSchema.safeParse({ ...valid, email: "bukan-email" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "<script>x</script>" }).success).toBe(false);
  });

  it("menolak field tak dikenal (mass assignment: role, plan)", () => {
    expect(registerSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, plan: "PRO" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("menerima kredensial dan menormalkan email", () => {
    const r = loginSchema.safeParse({ email: "A@B.co", password: PW });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.co");
  });

  it("menolak sandi kosong, terlalu panjang, dan field asing", () => {
    const email = "a@b.co";
    expect(loginSchema.safeParse({ email, password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email, password: "x".repeat(129) }).success).toBe(false);
    expect(loginSchema.safeParse({ email, password: PW, role: "ADMIN" }).success).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("menerima path relatif satu-origin", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/dashboard/paket?x=1")).toBe("/dashboard/paket?x=1");
  });

  it.each([
    "https://jahat.example",
    "//jahat.example",
    "/\\jahat.example",
    "javascript:alert(1)",
    "dashboard",
    "/dash\nboard",
    "/masuk",
    "/daftar?x=1",
    "/" + "a".repeat(250),
    "",
  ])("menolak %j", (raw) => {
    expect(safeRedirectPath(raw)).toBe("/dashboard");
  });

  it("menolak nilai bukan string", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath(["/a"])).toBe("/dashboard");
  });
});

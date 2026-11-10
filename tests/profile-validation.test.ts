import { describe, expect, it } from "vitest";
import { saveProfileSchema, slugSchema } from "@/lib/validation/profile";

const valid = {
  businessName: "Dewi Makeup Artist",
  whatsapp: "0812-3456-7890",
  bio: "MUA pengantin & wisuda",
  slug: "dewi-makeup",
};

describe("slugSchema", () => {
  it.each(["dewi", "dewi-makeup", "a1b", "x".repeat(30), "  Dewi-MUA  "])(
    "menerima %j dan menormalkan ke huruf kecil",
    (raw) => {
      const r = slugSchema.safeParse(raw);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe(raw.trim().toLowerCase());
    },
  );

  it.each([
    "ab", // terlalu pendek
    "x".repeat(31), // terlalu panjang
    "dewi_makeup", // garis bawah
    "dewi makeup", // spasi
    "dewi.makeup", // titik
    "-dewi", // diawali tanda hubung
    "dewi-", // diakhiri tanda hubung
    "dewi--mua", // dua tanda hubung
    "dewí", // bukan ASCII
    "../etc",
    "dewi/mua",
    "<script>",
    "",
  ])("menolak %j", (raw) => {
    expect(slugSchema.safeParse(raw).success).toBe(false);
  });

  it.each(["admin", "api", "login", "dashboard", "Masuk", "DAFTAR", "demo", "serviceshowcase"])(
    "menolak slug terlarang %j (tidak peka huruf besar/kecil)",
    (raw) => {
      expect(slugSchema.safeParse(raw).success).toBe(false);
    },
  );
});

describe("saveProfileSchema", () => {
  it("menerima input valid dan menormalkan nomor WhatsApp ke E.164 tanpa plus", () => {
    const r = saveProfileSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.whatsapp).toBe("6281234567890");
      expect(r.data.slug).toBe("dewi-makeup");
    }
  });

  it.each([
    ["+62 812-3456-7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["+1 415 555 2671", "14155552671"],
    ["0044 20 7946 0958", "442079460958"],
  ])("menormalkan nomor %j menjadi %j", (input, expected) => {
    const r = saveProfileSchema.safeParse({ ...valid, whatsapp: input });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.whatsapp).toBe(expected);
  });

  it.each(["", "abc", "8123456789", "0812", "+62 abc", "1".repeat(31)])(
    "menolak nomor WhatsApp %j",
    (whatsapp) => {
      const r = saveProfileSchema.safeParse({ ...valid, whatsapp });
      expect(r.success).toBe(false);
      if (!r.success && whatsapp !== "1".repeat(31)) {
        expect(r.error.flatten().fieldErrors.whatsapp).toBeTruthy();
      }
    },
  );

  it("bio kosong menjadi null dan baris baru dilipat jadi spasi", () => {
    const empty = saveProfileSchema.safeParse({ ...valid, bio: "   " });
    expect(empty.success && empty.data.bio).toBeNull();
    const multi = saveProfileSchema.safeParse({ ...valid, bio: "baris satu\n\nbaris dua" });
    expect(multi.success && multi.data.bio).toBe("baris satu baris dua");
  });

  it("menolak bio lebih dari 500 karakter", () => {
    expect(saveProfileSchema.safeParse({ ...valid, bio: "a".repeat(501) }).success).toBe(false);
  });

  it("menolak nama bisnis kosong, terlalu pendek, dan berisi markup", () => {
    for (const businessName of ["", "A", "<b>Dewi</b>", "Dewi\u0000"]) {
      expect(saveProfileSchema.safeParse({ ...valid, businessName }).success).toBe(false);
    }
  });

  it("menolak field tak dikenal (mass assignment: ownerId, role, plan)", () => {
    for (const extra of [{ ownerId: "x" }, { role: "ADMIN" }, { plan: "PRO" }, { id: "x" }]) {
      expect(saveProfileSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("confirmSlugChange hanya menerima 'on'", () => {
    expect(saveProfileSchema.safeParse({ ...valid, confirmSlugChange: "on" }).success).toBe(true);
    expect(saveProfileSchema.safeParse({ ...valid, confirmSlugChange: "true" }).success).toBe(
      false,
    );
  });
});

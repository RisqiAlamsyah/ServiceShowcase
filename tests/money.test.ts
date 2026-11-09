import { describe, expect, it } from "vitest";
import { formatRupiah, isValidRupiah, MAX_RUPIAH } from "@/lib/money";

describe("formatRupiah", () => {
  it.each([
    [0, "Rp 0"],
    [999, "Rp 999"],
    [1000, "Rp 1.000"],
    [350_000, "Rp 350.000"],
    [2_500_000, "Rp 2.500.000"],
    [2_850_000, "Rp 2.850.000"],
    [MAX_RUPIAH, "Rp 999.999.999.999"],
  ])("memformat %i menjadi %s", (amount, expected) => {
    expect(formatRupiah(amount)).toBe(expected);
  });

  it("memakai spasi biasa, bukan NBSP (aman untuk pesan WhatsApp)", () => {
    expect(formatRupiah(1000)).not.toContain("\u00a0");
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_RUPIAH + 1,
    Number.MAX_SAFE_INTEGER + 1,
  ])("menolak nominal tidak valid: %s", (amount) => {
    expect(() => formatRupiah(amount)).toThrow(RangeError);
  });
});

describe("isValidRupiah", () => {
  it("menerima bilangan bulat 0..MAX", () => {
    expect(isValidRupiah(0)).toBe(true);
    expect(isValidRupiah(MAX_RUPIAH)).toBe(true);
  });

  it("menolak string, null, pecahan, dan negatif", () => {
    for (const bad of ["1000", null, undefined, 10.5, -5, {}]) {
      expect(isValidRupiah(bad)).toBe(false);
    }
  });
});

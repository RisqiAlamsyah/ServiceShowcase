import { describe, expect, it } from "vitest";
import { calculateEstimate } from "@/lib/booking/calculator";
import { MAX_ADDONS, type BookingAddon, type BookingPackage } from "@/lib/booking/types";
import { MAX_RUPIAH } from "@/lib/money";

const pkg: BookingPackage = { id: "pkg1", title: "Paket Akad & Resepsi", basePrice: 2_500_000 };
const addons: BookingAddon[] = [
  { id: "a1", name: "Makeup Ibu Kandung", price: 350_000 },
  { id: "a2", name: "Hairdo Keluarga", price: 200_000 },
  { id: "a3", name: "Touch Up", price: 150_000 },
];

function estimate(overrides: Partial<Parameters<typeof calculateEstimate>[0]> = {}) {
  return calculateEstimate({
    pkg,
    addons,
    selectedAddonIds: [],
    allowAddons: true,
    ...overrides,
  });
}

describe("calculateEstimate: jalur berhasil", () => {
  it("hanya paket tanpa add-on", () => {
    const r = estimate();
    expect(r).toEqual({
      ok: true,
      data: {
        package: { id: "pkg1", label: "Paket Akad & Resepsi", price: 2_500_000 },
        addons: [],
        total: 2_500_000,
      },
    });
  });

  it("paket + satu add-on (contoh FRS 4.1)", () => {
    const r = estimate({ selectedAddonIds: ["a1"] });
    expect(r.ok && r.data.total).toBe(2_850_000);
  });

  it("menjumlahkan beberapa add-on dengan tepat", () => {
    const r = estimate({ selectedAddonIds: ["a1", "a2", "a3"] });
    expect(r.ok && r.data.total).toBe(3_200_000);
  });

  it("urutan add-on mengikuti penawaran, bukan urutan pilih", () => {
    const r = estimate({ selectedAddonIds: ["a3", "a1"] });
    expect(r.ok && r.data.addons.map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("ID duplikat dihitung sekali", () => {
    const r = estimate({ selectedAddonIds: ["a1", "a1", "a1"] });
    expect(r.ok && r.data.total).toBe(2_850_000);
    expect(r.ok && r.data.addons).toHaveLength(1);
  });

  it("tidak mengubah array masukan", () => {
    const selected = ["a2", "a1"];
    const offered = [...addons];
    estimate({ selectedAddonIds: selected, addons: offered });
    expect(selected).toEqual(["a2", "a1"]);
    expect(offered).toEqual(addons);
  });

  it("harga 0 diperbolehkan (paket/add-on gratis)", () => {
    const r = estimate({ pkg: { ...pkg, basePrice: 0 }, selectedAddonIds: [] });
    expect(r.ok && r.data.total).toBe(0);
  });
});

describe("calculateEstimate: input tidak valid dan batas", () => {
  it("tier Free: add-on terpilih ditolak walau ID valid", () => {
    const r = estimate({ allowAddons: false, selectedAddonIds: ["a1"] });
    expect(r).toMatchObject({ ok: false, code: "ADDONS_NOT_ALLOWED" });
  });

  it("tier Free tanpa add-on tetap berhasil", () => {
    const r = estimate({ allowAddons: false });
    expect(r.ok && r.data.total).toBe(2_500_000);
  });

  it("add-on tidak dikenal (mis. milik paket/vendor lain) ditolak", () => {
    const r = estimate({ selectedAddonIds: ["a1", "milik-vendor-lain"] });
    expect(r).toMatchObject({ ok: false, code: "UNKNOWN_ADDON" });
  });

  it("terlalu banyak add-on ditolak", () => {
    const many = Array.from({ length: MAX_ADDONS + 1 }, (_, i) => `x${i}`);
    expect(estimate({ selectedAddonIds: many })).toMatchObject({
      ok: false,
      code: "TOO_MANY_ADDONS",
    });
  });

  it.each([-1, 1.5, Number.NaN, MAX_RUPIAH + 1])(
    "harga paket tidak valid (%s) ditolak",
    (basePrice) => {
      expect(estimate({ pkg: { ...pkg, basePrice } })).toMatchObject({
        ok: false,
        code: "INVALID_PRICE",
      });
    },
  );

  it("harga add-on terpilih yang rusak ditolak, add-on lain yang rusak tidak memblokir", () => {
    const offered: BookingAddon[] = [
      { id: "ok", name: "Normal", price: 100_000 },
      { id: "rusak", name: "Rusak", price: -5 },
    ];
    expect(estimate({ addons: offered, selectedAddonIds: ["rusak"] })).toMatchObject({
      ok: false,
      code: "INVALID_PRICE",
    });
    const r = estimate({ addons: offered, selectedAddonIds: ["ok"] });
    expect(r.ok && r.data.total).toBe(2_600_000);
  });

  it("total yang melewati batas ditolak, bukan dibiarkan meluap", () => {
    const r = estimate({
      pkg: { ...pkg, basePrice: MAX_RUPIAH },
      addons: [{ id: "a1", name: "Satu rupiah", price: 1 }],
      selectedAddonIds: ["a1"],
    });
    expect(r).toMatchObject({ ok: false, code: "TOTAL_TOO_LARGE" });
  });

  it("pesan galat generik, tidak memuat data masukan", () => {
    const r = estimate({ selectedAddonIds: ["<script>alert(1)</script>"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toContain("script");
  });
});

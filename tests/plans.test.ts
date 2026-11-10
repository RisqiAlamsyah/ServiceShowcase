import { describe, expect, it } from "vitest";
import {
  MAX_ADDONS_PER_PACKAGE,
  PLAN_LIMITS,
  addonsPubliclyVisible,
  publiclyVisiblePackageIds,
  sortPackages,
} from "@/lib/plans";

const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));
const pkg = (id: string, position: number, sec = 0) => ({ id, position, createdAt: at(sec) });

describe("PLAN_LIMITS", () => {
  it("Free: 2 paket tanpa add-on; Pro: add-on boleh dan batas lebih besar", () => {
    expect(PLAN_LIMITS.FREE).toEqual({ maxPackages: 2, addonsAllowed: false });
    expect(PLAN_LIMITS.PRO.addonsAllowed).toBe(true);
    expect(PLAN_LIMITS.PRO.maxPackages).toBeGreaterThan(PLAN_LIMITS.FREE.maxPackages);
    expect(MAX_ADDONS_PER_PACKAGE).toBe(20);
  });
});

describe("sortPackages", () => {
  it("mengurutkan menurut position, lalu createdAt, lalu id (deterministik)", () => {
    const sorted = sortPackages([pkg("c", 1, 5), pkg("b", 0, 9), pkg("a", 0, 9), pkg("z", 0, 1)]);
    expect(sorted.map((p) => p.id)).toEqual(["z", "a", "b", "c"]);
  });

  it("tidak mengubah array masukan", () => {
    const input = [pkg("b", 1), pkg("a", 0)];
    sortPackages(input);
    expect(input.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("publiclyVisiblePackageIds", () => {
  const five = [pkg("p1", 0), pkg("p2", 1), pkg("p3", 2), pkg("p4", 3), pkg("p5", 4)];

  it("Free hanya menampilkan 2 paket pertama; sisanya disembunyikan, bukan dihapus", () => {
    const visible = publiclyVisiblePackageIds("FREE", five);
    expect([...visible]).toEqual(["p1", "p2"]);
    expect(five).toHaveLength(5);
  });

  it("Pro menampilkan semuanya (turun lalu naik lagi mengembalikan semuanya)", () => {
    expect(publiclyVisiblePackageIds("PRO", five).size).toBe(5);
  });

  it("memakai urutan, bukan urutan array masukan", () => {
    const shuffled = [pkg("p3", 2), pkg("p1", 0), pkg("p2", 1)];
    expect([...publiclyVisiblePackageIds("FREE", shuffled)].sort()).toEqual(["p1", "p2"]);
  });

  it("di bawah batas: semua terlihat; kosong: kosong", () => {
    expect(publiclyVisiblePackageIds("FREE", [pkg("only", 0)]).size).toBe(1);
    expect(publiclyVisiblePackageIds("FREE", []).size).toBe(0);
  });
});

describe("addonsPubliclyVisible", () => {
  it("hanya Pro", () => {
    expect(addonsPubliclyVisible("FREE")).toBe(false);
    expect(addonsPubliclyVisible("PRO")).toBe(true);
  });
});

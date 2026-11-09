import { describe, expect, it } from "vitest";
import { formatIdDate, isValidIsoDate, todayInJakarta } from "@/lib/booking/date";

describe("isValidIsoDate", () => {
  it.each(["2026-12-15", "2028-02-29", "2026-01-31", "2026-12-31"])("menerima %s", (d) => {
    expect(isValidIsoDate(d)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2027-02-29", // bukan tahun kabisat
    "2026-13-01",
    "2026-00-10",
    "2026-12-32",
    "2026-4-5",
    "15/12/2026",
    "2026-12-15T00:00:00Z",
    "",
    " 2026-12-15",
    "0050-01-01",
  ])("menolak %j", (d) => {
    expect(isValidIsoDate(d)).toBe(false);
  });
});

describe("formatIdDate", () => {
  it("mengubah ISO menjadi dd/mm/yyyy dengan nol di depan", () => {
    expect(formatIdDate("2026-12-15")).toBe("15/12/2026");
    expect(formatIdDate("2026-01-05")).toBe("05/01/2026");
  });

  it("melempar untuk tanggal tidak valid", () => {
    expect(() => formatIdDate("2026-02-30")).toThrow(RangeError);
  });
});

describe("todayInJakarta", () => {
  it("memakai zona WIB, bukan UTC", () => {
    // 20:00 UTC tanggal 14 = 03:00 WIB tanggal 15
    expect(todayInJakarta(new Date("2026-12-14T20:00:00Z"))).toBe("2026-12-15");
    // 16:59 UTC tanggal 14 = 23:59 WIB tanggal 14
    expect(todayInJakarta(new Date("2026-12-14T16:59:00Z"))).toBe("2026-12-14");
  });
});

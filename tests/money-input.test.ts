import { describe, expect, it } from "vitest";
import { MAX_RUPIAH, parseRupiahInput } from "@/lib/money";

describe("parseRupiahInput", () => {
  it.each([
    ["0", 0],
    ["2500000", 2_500_000],
    ["2.500.000", 2_500_000],
    ["Rp 2.500.000", 2_500_000],
    ["rp2500000", 2_500_000],
    ["Rp. 150.000", 150_000],
    ["  150000  ", 150_000],
    ["999.999.999.999", MAX_RUPIAH],
  ])("menerima %j sebagai %d", (raw, expected) => {
    expect(parseRupiahInput(raw)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "abc",
    "1e6",
    "-1",
    "+100",
    "2.5", // ambigu: bukan pemisah ribuan yang benar
    "2,5",
    "1.00.000",
    "2.500.0",
    "2 500 000",
    "1000000000000", // 13 digit, di atas batas
    "9007199254740993",
    "0x10",
    "Rp",
    "２５００", // digit lebar penuh
  ])("menolak %j", (raw) => {
    expect(parseRupiahInput(raw)).toBeNull();
  });
});

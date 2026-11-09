import { describe, expect, it } from "vitest";
import { calculateEstimate } from "@/lib/booking/calculator";
import type { Estimate } from "@/lib/booking/types";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  cleanMessageText,
  normalizeWhatsAppNumber,
} from "@/lib/booking/whatsapp";

// Contoh persis dari SRS (FRS 4.1).
const SRS_URL =
  "https://wa.me/628123456789?text=Halo%20kak!%0ASaya%20mau%20booking%20jasa%20untuk:%0A%0ANama:%20Siti%20Rahma%0ATanggal:%2015/12/2026%0APaket:%20Paket%20Akad%20%26%20Resepsi%20(Rp%202.500.000)%0AAdd-on:%0A-%20Makeup%20Ibu%20Kandung%20(Rp%20350.000)%0A%0ATotal%20Estimasi:%20Rp%202.850.000%0A%0AApakah%20slot%20tersedia?";

function makeEstimate(overrides: Partial<Estimate> = {}): Estimate {
  const r = calculateEstimate({
    pkg: { id: "p1", title: "Paket Akad & Resepsi", basePrice: 2_500_000 },
    addons: [{ id: "a1", name: "Makeup Ibu Kandung", price: 350_000 }],
    selectedAddonIds: ["a1"],
    allowAddons: true,
  });
  if (!r.ok) throw new Error("fixture rusak");
  return { ...r.data, ...overrides };
}

function url(overrides: Partial<Parameters<typeof buildWhatsAppUrl>[0]> = {}) {
  return buildWhatsAppUrl({
    vendorPhone: "628123456789",
    clientName: "Siti Rahma",
    eventDate: "2026-12-15",
    estimate: makeEstimate(),
    ...overrides,
  });
}

describe("buildWhatsAppUrl: kesesuaian dengan SRS", () => {
  it("menghasilkan URL identik karakter per karakter dengan contoh FRS 4.1", () => {
    const r = url();
    expect(r).toEqual({ ok: true, data: SRS_URL });
  });

  it("pesan terdekode sama dengan format FRS", () => {
    const r = url();
    if (!r.ok) throw new Error("harus berhasil");
    const text = new URL(r.data).searchParams.get("text");
    expect(text).toBe(
      [
        "Halo kak!",
        "Saya mau booking jasa untuk:",
        "",
        "Nama: Siti Rahma",
        "Tanggal: 15/12/2026",
        "Paket: Paket Akad & Resepsi (Rp 2.500.000)",
        "Add-on:",
        "- Makeup Ibu Kandung (Rp 350.000)",
        "",
        "Total Estimasi: Rp 2.850.000",
        "",
        "Apakah slot tersedia?",
      ].join("\n"),
    );
  });

  it("tanpa add-on, bagian 'Add-on:' dihilangkan", () => {
    const msg = buildWhatsAppMessage({
      clientName: "Siti Rahma",
      eventDate: "2026-12-15",
      estimate: makeEstimate({ addons: [], total: 2_500_000 }),
    });
    expect(msg).not.toContain("Add-on:");
    expect(msg).toContain("Total Estimasi: Rp 2.500.000");
  });

  it("beberapa add-on tampil berurutan", () => {
    const msg = buildWhatsAppMessage({
      clientName: "Rina",
      eventDate: "2026-12-15",
      estimate: makeEstimate({
        addons: [
          { id: "a1", label: "Satu", price: 100_000 },
          { id: "a2", label: "Dua", price: 200_000 },
        ],
        total: 2_800_000,
      }),
    });
    expect(msg.indexOf("- Satu (Rp 100.000)")).toBeLessThan(msg.indexOf("- Dua (Rp 200.000)"));
  });
});

describe("buildWhatsAppUrl: keamanan URL dan pesan", () => {
  it("host wa.me dan hanya satu parameter 'text'", () => {
    const r = url();
    if (!r.ok) throw new Error("harus berhasil");
    const u = new URL(r.data);
    expect(u.protocol).toBe("https:");
    expect(u.host).toBe("wa.me");
    expect([...u.searchParams.keys()]).toEqual(["text"]);
    expect(u.hash).toBe("");
  });

  it("& = # + % dari isi pesan ter-encode (tidak bisa menambah parameter atau memotong URL)", () => {
    const r = url({
      estimate: makeEstimate({
        package: { id: "p1", label: "A&B=C#D+E%F", price: 1000 },
        addons: [],
        total: 1000,
      }),
    });
    if (!r.ok) throw new Error("harus berhasil");
    const query = r.data.split("?")[1] ?? "";
    expect(query).toContain("A%26B%3DC%23D%2BE%25F");
    const u = new URL(r.data);
    expect([...u.searchParams.keys()]).toEqual(["text"]);
    expect(u.hash).toBe("");
    expect(u.searchParams.get("text")).toContain("A&B=C#D+E%F");
  });

  it("nama paket dari vendor dengan baris baru tidak membuat baris pesan palsu", () => {
    const msg = buildWhatsAppMessage({
      clientName: "Siti",
      eventDate: "2026-12-15",
      estimate: makeEstimate({
        package: { id: "p1", label: "Paket\nTotal Estimasi: Rp 1\r\nHalo", price: 1000 },
        addons: [],
        total: 1000,
      }),
    });
    const totalLines = msg.split("\n").filter((l) => l.startsWith("Total Estimasi:"));
    expect(totalLines).toEqual(["Total Estimasi: Rp 1.000"]);
  });

  it("nama klien dibersihkan lagi di tahap pesan (pertahanan berlapis)", () => {
    const msg = buildWhatsAppMessage({
      clientName: "Siti\nNama: Palsu",
      eventDate: "2026-12-15",
      estimate: makeEstimate(),
    });
    expect(msg.split("\n").filter((l) => l.startsWith("Nama:"))).toEqual([
      "Nama: Siti Nama: Palsu",
    ]);
  });

  it("nomor vendor tidak valid ditolak", () => {
    expect(url({ vendorPhone: "bukan-nomor" })).toMatchObject({ ok: false, code: "INVALID_PHONE" });
  });

  it("pesan yang terlalu panjang ditolak", () => {
    const addons = Array.from({ length: 20 }, (_, i) => ({
      id: `a${i}`,
      label: "X".repeat(100),
      price: 1000,
    }));
    const r = url({ estimate: makeEstimate({ addons, total: 1_000_000 }) });
    expect(r).toMatchObject({ ok: false, code: "MESSAGE_TOO_LONG" });
  });

  it("nomor di dalam path tidak bisa disusupi lewat input pemesan (hanya digit)", () => {
    const r = url({ vendorPhone: "628123456789/../evil" });
    expect(r.ok).toBe(false);
  });
});

describe("normalizeWhatsAppNumber", () => {
  it.each([
    ["08123456789", "628123456789"],
    ["0812-3456-789", "628123456789"],
    ["+62 812-3456-789", "628123456789"],
    ["(0812) 3456 789", "628123456789"],
    ["628123456789", "628123456789"],
    ["  +628123456789  ", "628123456789"],
    ["0062 812-3456-789", "628123456789"], // awalan internasional 00 untuk nomor Indonesia
  ])("menormalkan nomor Indonesia %j menjadi %s", (raw, expected) => {
    expect(normalizeWhatsAppNumber(raw)).toEqual({ ok: true, data: expected });
  });

  it.each([
    ["+1 415 555 2671", "14155552671"], // AS
    ["+44 20 7946 0958", "442079460958"], // Inggris
    ["0044 20 7946 0958", "442079460958"], // awalan 00
    ["+65 8123 4567", "6581234567"], // Singapura
    ["+60 12-345 6789", "60123456789"], // Malaysia
    ["+61 4 1234 5678", "61412345678"], // Australia
    ["+81 90-1234-5678", "819012345678"], // Jepang
  ])("menormalkan nomor internasional %j menjadi %s", (raw, expected) => {
    expect(normalizeWhatsAppNumber(raw)).toEqual({ ok: true, data: expected });
  });

  it("nomor internasional dipakai apa adanya di URL wa.me", () => {
    const r = buildWhatsAppUrl({
      vendorPhone: "+65 8123 4567",
      clientName: "Siti Rahma",
      eventDate: "2026-12-15",
      estimate: makeEstimate(),
    });
    expect(r.ok && r.data.startsWith("https://wa.me/6581234567?text=")).toBe(true);
  });

  it.each([
    ["angka telanjang non-Indonesia (bisa salah terbaca)", "14155552671"],
    ["angka telanjang tanpa 0 di depan", "8123456789"],
    ["internasional terlalu pendek (7 digit)", "+1234567"],
    ["internasional terlalu panjang (16 digit)", "+1234567890123456"],
    ["kode negara diawali nol", "+0 123456789"],
    ["00 diikuti nol", "000441234567890"],
    ["Indonesia dengan nol setelah 62", "+62 0812 3456 789"],
    ["Indonesia terlalu pendek", "+62 812345"],
    ["huruf di dalam nomor", "+1 415 CALL NOW"],
    ["dua tanda plus", "++14155552671"],
    ["plus di tengah", "1+4155552671"],
  ])("menolak %s", (_label, raw) => {
    expect(normalizeWhatsAppNumber(raw)).toMatchObject({ ok: false, code: "INVALID_PHONE" });
  });

  it.each([
    "",
    "abc",
    "12345",
    "0812",
    "08123456789012345678",
    "+0628123456789",
    "628123456789; DROP",
    "62812345678a",
    "x".repeat(40),
    "+",
  ])("menolak %j", (raw) => {
    expect(normalizeWhatsAppNumber(raw)).toMatchObject({ ok: false, code: "INVALID_PHONE" });
  });
});

describe("cleanMessageText", () => {
  it("mengganti baris baru, tab, dan karakter kontrol dengan spasi lalu melipatnya", () => {
    expect(cleanMessageText("a\nb\r\nc\td\u0000e")).toBe("a b c d e");
  });

  it("membuang karakter format/bidi (RTL override)", () => {
    expect(cleanMessageText("abc\u202edef")).toBe("abc def");
  });

  it("memotong sesuai batas panjang", () => {
    expect(cleanMessageText("x".repeat(500), 100)).toHaveLength(100);
  });
});

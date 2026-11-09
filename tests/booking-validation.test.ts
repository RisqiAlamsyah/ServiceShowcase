import { describe, expect, it } from "vitest";
import { MAX_ADDONS } from "@/lib/booking/types";
import { createBookingInputSchema, normalizeClientName } from "@/lib/validation/booking";

const TODAY = "2026-11-09";
const schema = createBookingInputSchema(TODAY);

const valid = {
  clientName: "Siti Rahma",
  eventDate: "2026-12-15",
  packageId: "pkg_1",
  addonIds: ["a1", "a2"],
};

function errorFields(input: unknown): string[] {
  const r = schema.safeParse(input);
  if (r.success) return [];
  return [...new Set(r.error.issues.map((i) => i.path.join(".")))];
}

describe("bookingInputSchema: jalur berhasil", () => {
  it("menerima input valid", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("menerima tanggal hari ini dan tanpa add-on", () => {
    expect(schema.safeParse({ ...valid, eventDate: TODAY, addonIds: [] }).success).toBe(true);
  });

  it.each(["Siti Rahma, S.Pd", "O'Neil", "Dewi-Sartika", "Müller", "José Álvarez", "Rina 2"])(
    "menerima nama wajar: %s",
    (clientName) => {
      expect(schema.safeParse({ ...valid, clientName }).success).toBe(true);
    },
  );

  it("menormalkan nama: spasi berlebih dan baris baru menjadi spasi tunggal", () => {
    const r = schema.safeParse({ ...valid, clientName: "  Siti \n\t  Rahma  " });
    expect(r.success && r.data.clientName).toBe("Siti Rahma");
  });
});

describe("bookingInputSchema: nama (injeksi dan batas)", () => {
  it.each([
    ["markup", "<script>alert(1)</script>"],
    ["parameter URL", "Siti&text=palsu"],
    ["fragmen/penyamaran URL", "Siti#x"],
    ["persen-encode (CRLF)", "Siti%0AHalo"],
    ["plus", "Siti+Rahma"],
    ["sama dengan", "a=b"],
    ["emoji", "Siti 😀"],
    ["karakter kontrol NUL", "Siti\u0000Rahma"],
    ["RTL override", "Siti\u202erahma"],
    ["zero width", "Si\u200bti"],
    ["terlalu pendek", "A"],
    ["hanya spasi", "     "],
    ["kosong", ""],
    ["terlalu panjang", "A".repeat(61)],
    ["sangat panjang", "A".repeat(500)],
  ])("menolak %s", (_label, clientName) => {
    expect(errorFields({ ...valid, clientName })).toContain("clientName");
  });

  it("menolak nama non-string", () => {
    expect(errorFields({ ...valid, clientName: 12345 })).toContain("clientName");
    expect(errorFields({ ...valid, clientName: null })).toContain("clientName");
    expect(errorFields({ ...valid, clientName: ["Siti"] })).toContain("clientName");
  });

  it("normalizeClientName konsisten", () => {
    expect(normalizeClientName("  a   b ")).toBe("a b");
  });
});

describe("bookingInputSchema: tanggal acara", () => {
  it.each([
    ["kemarin", "2026-11-08"],
    ["bukan kalender", "2026-02-30"],
    ["format dd/mm/yyyy", "15/12/2026"],
    ["format ISO + waktu", "2026-12-15T10:00:00Z"],
    ["terlalu jauh", "2030-01-01"],
    ["kosong", ""],
  ])("menolak %s", (_label, eventDate) => {
    expect(errorFields({ ...valid, eventDate })).toContain("eventDate");
  });

  it("batas 3 tahun: tahun ke-3 boleh, tahun ke-4 tidak", () => {
    expect(schema.safeParse({ ...valid, eventDate: "2029-12-31" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, eventDate: "2030-01-01" }).success).toBe(false);
  });
});

describe("bookingInputSchema: ID dan struktur", () => {
  it("menolak ID dengan karakter berbahaya", () => {
    expect(errorFields({ ...valid, packageId: "../etc/passwd" })).toContain("packageId");
    expect(errorFields({ ...valid, packageId: "a b" })).toContain("packageId");
    expect(errorFields({ ...valid, packageId: "" })).toContain("packageId");
    expect(errorFields({ ...valid, addonIds: ["ok", "bad id"] })).toContain("addonIds.1");
  });

  it("menolak add-on melebihi batas", () => {
    const addonIds = Array.from({ length: MAX_ADDONS + 1 }, (_, i) => `a${i}`);
    expect(errorFields({ ...valid, addonIds })).toContain("addonIds");
  });

  it("menolak field tak dikenal (mass assignment) lewat .strict()", () => {
    const r = schema.safeParse({ ...valid, total: 1, planType: "pro", isAdmin: true });
    expect(r.success).toBe(false);
  });

  it("menolak field yang hilang dan bukan objek", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse("string").success).toBe(false);
  });

  it("pesan galat tidak memantulkan input pengguna", () => {
    const r = schema.safeParse({ ...valid, clientName: "<script>RAHASIA</script>" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).not.toContain("RAHASIA");
    }
  });
});

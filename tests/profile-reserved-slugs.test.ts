import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "@/lib/profile/reserved-slugs";
import { slugSchema } from "@/lib/validation/profile";

const APP_DIR = join(process.cwd(), "src", "app");

// Segmen rute statis tingkat atas: folder biasa, ditambah isi route group "(nama)" (tidak muncul di URL).
function topLevelSegments(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith("(")) out.push(...topLevelSegments(join(dir, name)));
    else if (name.startsWith("[") || name.startsWith("_") || name.startsWith("@")) continue;
    else out.push(name);
  }
  return out;
}

describe("slug terlarang", () => {
  it("mencakup SETIAP rute tingkat atas di src/app (rute baru wajib ikut didaftarkan)", () => {
    const segments = topLevelSegments(APP_DIR);
    expect(segments.length).toBeGreaterThan(0);
    const missing = segments.filter((s) => !RESERVED_SLUGS.has(s));
    expect(missing, `tambahkan ke RESERVED_SLUGS: ${missing.join(", ")}`).toEqual([]);
  });

  it("semua entri huruf kecil tanpa spasi (agar pencocokan konsisten)", () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug).toBe(slug.toLowerCase());
      expect(slug).not.toMatch(/\s/);
    }
  });

  it("setiap rute aplikasi ditolak oleh skema slug", () => {
    for (const segment of topLevelSegments(APP_DIR)) {
      // Segmen yang tidak memenuhi regex slug (mis. huruf besar) ditolak karena alasan lain; yang
      // memenuhi regex harus ditolak karena daftar terlarang.
      expect(slugSchema.safeParse(segment).success, segment).toBe(false);
    }
  });
});

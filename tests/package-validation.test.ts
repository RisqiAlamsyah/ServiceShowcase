import { describe, expect, it } from "vitest";
import {
  createAddonSchema,
  idOnlySchema,
  packageFieldsSchema,
  updateAddonSchema,
  updatePackageSchema,
} from "@/lib/validation/package";

const ID = "clh3am9gn0000a6lxg5c8k1zq"; // bentuk cuid yang valid
const pkg = { title: "Paket Akad", description: "Makeup + hairdo", basePrice: "2.500.000" };

describe("packageFieldsSchema", () => {
  it("menerima input valid dan mengubah harga menjadi bilangan bulat", () => {
    const r = packageFieldsSchema.safeParse(pkg);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ ...pkg, basePrice: 2_500_000 });
  });

  it("deskripsi boleh kosong dan baris baru dilipat jadi spasi", () => {
    const empty = packageFieldsSchema.safeParse({ ...pkg, description: "" });
    expect(empty.success && empty.data.description).toBe("");
    const multi = packageFieldsSchema.safeParse({ ...pkg, description: "a\n\nb" });
    expect(multi.success && multi.data.description).toBe("a b");
  });

  it.each(["", "A", "<b>Paket</b>", "Paket\u0000", "Paket‮", "x".repeat(101)])(
    "menolak nama paket %j",
    (title) => {
      expect(packageFieldsSchema.safeParse({ ...pkg, title }).success).toBe(false);
    },
  );

  it.each(["", "abc", "-5", "1e6", "2.5", "1000000000000"])("menolak harga %j", (basePrice) => {
    const r = packageFieldsSchema.safeParse({ ...pkg, basePrice });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.basePrice).toBeTruthy();
  });

  it("menolak deskripsi lebih dari 500 karakter", () => {
    expect(packageFieldsSchema.safeParse({ ...pkg, description: "a".repeat(501) }).success).toBe(
      false,
    );
  });

  it("menolak field tak dikenal (mass assignment: ownerId, position, id)", () => {
    for (const extra of [{ ownerId: "x" }, { position: 0 }, { id: ID }, { plan: "PRO" }]) {
      expect(packageFieldsSchema.safeParse({ ...pkg, ...extra }).success).toBe(false);
    }
  });
});

describe("updatePackageSchema", () => {
  it("mewajibkan id cuid", () => {
    expect(updatePackageSchema.safeParse({ ...pkg, id: ID }).success).toBe(true);
    for (const id of ["", "1", "../x", "' OR 1=1 --", "a b"]) {
      expect(updatePackageSchema.safeParse({ ...pkg, id }).success, id).toBe(false);
    }
  });
});

describe("addon", () => {
  const addon = { name: "Hairdo tambahan", price: "150.000" };

  it("createAddonSchema menerima input valid dan mewajibkan packageId cuid", () => {
    const r = createAddonSchema.safeParse({ ...addon, packageId: ID });
    expect(r.success && r.data.price).toBe(150_000);
    expect(createAddonSchema.safeParse({ ...addon, packageId: "x" }).success).toBe(false);
  });

  it("updateAddonSchema tidak menerima pemindahan paket (packageId) atau ownerId", () => {
    expect(updateAddonSchema.safeParse({ ...addon, id: ID }).success).toBe(true);
    expect(updateAddonSchema.safeParse({ ...addon, id: ID, packageId: ID }).success).toBe(false);
    expect(updateAddonSchema.safeParse({ ...addon, id: ID, ownerId: ID }).success).toBe(false);
  });

  it("menolak nama dan harga tidak valid", () => {
    expect(updateAddonSchema.safeParse({ ...addon, id: ID, name: "" }).success).toBe(false);
    expect(updateAddonSchema.safeParse({ ...addon, id: ID, price: "gratis" }).success).toBe(false);
  });
});

describe("idOnlySchema", () => {
  it("hanya menerima id cuid dan tidak ada field lain", () => {
    expect(idOnlySchema.safeParse({ id: ID }).success).toBe(true);
    expect(idOnlySchema.safeParse({ id: ID, ownerId: "x" }).success).toBe(false);
    expect(idOnlySchema.safeParse({}).success).toBe(false);
  });
});

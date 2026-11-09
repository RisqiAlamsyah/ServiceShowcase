import { isValidRupiah, MAX_RUPIAH } from "@/lib/money";
import { fail, ok, type Result } from "@/types/result";
import {
  MAX_ADDONS,
  type BookingAddon,
  type BookingPackage,
  type Estimate,
  type EstimateLine,
} from "./types";

export type EstimateErrorCode =
  "INVALID_PRICE" | "ADDONS_NOT_ALLOWED" | "TOO_MANY_ADDONS" | "UNKNOWN_ADDON" | "TOTAL_TOO_LARGE";

export type CalculateEstimateInput = {
  pkg: BookingPackage;
  /** Add-on yang ditawarkan paket ini (dari server). */
  addons: readonly BookingAddon[];
  /** ID add-on yang dipilih pemesan (tidak tepercaya). */
  selectedAddonIds: readonly string[];
  /** false pada tier Free: kalkulator dasar tanpa add-on (SRS 7.1). */
  allowAddons: boolean;
};

// Menghitung estimasi dengan bilangan bulat. Harga hanya dibaca dari data server;
// pemesan hanya memilih ID. Urutan add-on mengikuti urutan penawaran, bukan urutan klik.
export function calculateEstimate(
  input: CalculateEstimateInput,
): Result<Estimate, EstimateErrorCode> {
  const { pkg, addons, selectedAddonIds, allowAddons } = input;

  if (!isValidRupiah(pkg.basePrice)) {
    return fail("INVALID_PRICE", "Harga paket tidak valid.");
  }

  const selected = new Set(selectedAddonIds);

  if (selected.size > 0 && !allowAddons) {
    return fail("ADDONS_NOT_ALLOWED", "Paket langganan saat ini tidak mendukung add-on.");
  }
  if (selected.size > MAX_ADDONS) {
    return fail("TOO_MANY_ADDONS", `Maksimal ${MAX_ADDONS} add-on.`);
  }

  const offeredIds = new Set(addons.map((addon) => addon.id));
  for (const id of selected) {
    if (!offeredIds.has(id)) {
      return fail("UNKNOWN_ADDON", "Add-on tidak ditemukan pada paket ini.");
    }
  }

  const lines: EstimateLine[] = [];
  const seen = new Set<string>();
  for (const addon of addons) {
    if (!selected.has(addon.id) || seen.has(addon.id)) continue;
    seen.add(addon.id);
    if (!isValidRupiah(addon.price)) {
      return fail("INVALID_PRICE", "Harga add-on tidak valid.");
    }
    lines.push({ id: addon.id, label: addon.name, price: addon.price });
  }

  let total = pkg.basePrice;
  for (const line of lines) {
    total += line.price;
    if (total > MAX_RUPIAH) {
      return fail("TOTAL_TOO_LARGE", "Total estimasi melebihi batas.");
    }
  }

  return ok({
    package: { id: pkg.id, label: pkg.title, price: pkg.basePrice },
    addons: lines,
    total,
  });
}

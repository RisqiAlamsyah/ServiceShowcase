"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAddonSchema,
  idOnlySchema,
  packageFieldsSchema,
  updateAddonSchema,
  updatePackageSchema,
} from "@/lib/validation/package";
import { AuthError, requireUser } from "@/server/auth/guards";
import { RATE_RULES, consume } from "@/server/auth/rate-limit";
import {
  createAddon,
  createPackage,
  deleteAddon,
  deletePackage,
  updateAddon,
  updatePackage,
} from "@/server/package/service";
import type { FormState, FormValues } from "@/types/action";

const GENERIC = "Terjadi kesalahan. Coba lagi.";
const NOT_FOUND = "Data tidak ditemukan.";
const INVALID = "Periksa kembali isian Anda.";

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function pick(formData: FormData, names: readonly string[]): FormValues {
  return Object.fromEntries(names.map((n) => [n, text(formData, n) ?? ""]));
}

// Urutan wajib di setiap titik masuk: login → rate limit → (handler: validasi → service).
// `values` dikembalikan agar isian tidak hilang saat React me-reset form setelah action.
async function guarded<T>(
  formData: FormData,
  fields: readonly string[],
  handler: (userId: string, values: FormValues) => Promise<FormState<T>>,
  name: string,
): Promise<FormState<T>> {
  const values = pick(formData, fields);
  try {
    const user = await requireUser();
    if (!(await consume("package:write", user.id, RATE_RULES.packageWrite))) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Terlalu banyak permintaan. Coba lagi nanti.",
        values,
      };
    }
    return await handler(user.id, values);
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, code: "UNAUTHENTICATED", message: "Silakan masuk.", values };
    }
    // Hanya nama error ke log; pesan bisa memuat data pribadi.
    console.error(`${name} gagal`, e instanceof Error ? e.name : "unknown");
    return { ok: false, code: "INTERNAL", message: GENERIC, values };
  }
}

function invalid<T>(
  fieldErrors: Record<string, string[] | undefined>,
  values: FormValues,
): FormState<T> {
  return { ok: false, code: "VALIDATION", message: INVALID, fieldErrors, values };
}

function notFound<T>(values: FormValues): FormState<T> {
  return { ok: false, code: "NOT_FOUND", message: NOT_FOUND, values };
}

const PACKAGE_FIELDS = ["title", "description", "basePrice"] as const;
const ADDON_FIELDS = ["name", "price"] as const;

export async function createPackageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guarded(
    formData,
    PACKAGE_FIELDS,
    async (userId, values) => {
      const parsed = packageFieldsSchema.safeParse({
        title: text(formData, "title"),
        description: text(formData, "description") ?? "",
        basePrice: text(formData, "basePrice"),
      });
      if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors, values);

      const result = await createPackage(userId, parsed.data);
      if (!result.ok) {
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "Batas paket tercapai. Hapus paket lain atau upgrade ke Pro.",
          values,
        };
      }
      revalidatePath("/dashboard/paket");
      revalidatePath("/dashboard");
      return { ok: true, data: undefined };
    },
    "createPackageAction",
  );
}

export async function updatePackageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guarded(
    formData,
    PACKAGE_FIELDS,
    async (userId, values) => {
      const parsed = updatePackageSchema.safeParse({
        id: text(formData, "id"),
        title: text(formData, "title"),
        description: text(formData, "description") ?? "",
        basePrice: text(formData, "basePrice"),
      });
      if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors, values);

      const { id, ...fields } = parsed.data;
      if (!(await updatePackage(userId, id, fields))) return notFound(values);

      revalidatePath("/dashboard/paket");
      revalidatePath(`/dashboard/paket/${id}`);
      return {
        ok: true,
        data: undefined,
        values: {
          title: fields.title,
          description: fields.description,
          basePrice: String(fields.basePrice),
        },
      };
    },
    "updatePackageAction",
  );
}

export async function deletePackageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await guarded(
    formData,
    [],
    async (userId, values) => {
      const parsed = idOnlySchema.safeParse({ id: text(formData, "id") });
      if (!parsed.success) return notFound(values);
      if (!(await deletePackage(userId, parsed.data.id))) return notFound(values);

      revalidatePath("/dashboard/paket");
      revalidatePath("/dashboard");
      return { ok: true, data: undefined };
    },
    "deletePackageAction",
  );
  // redirect melempar error khusus Next, jadi harus berada di luar try/catch.
  if (result?.ok) redirect("/dashboard/paket");
  return result;
}

export async function createAddonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded(
    formData,
    ADDON_FIELDS,
    async (userId, values) => {
      const parsed = createAddonSchema.safeParse({
        packageId: text(formData, "packageId"),
        name: text(formData, "name"),
        price: text(formData, "price"),
      });
      if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors, values);

      const { packageId, ...fields } = parsed.data;
      const result = await createAddon(userId, packageId, fields);
      if (!result.ok) {
        if (result.code === "NOT_FOUND") return notFound(values);
        return {
          ok: false,
          code: "FORBIDDEN",
          message:
            result.code === "PLAN_REQUIRED"
              ? "Add-on tersedia di paket Pro."
              : "Batas add-on per paket tercapai.",
          values,
        };
      }
      revalidatePath(`/dashboard/paket/${packageId}`);
      revalidatePath("/dashboard/paket");
      return { ok: true, data: undefined };
    },
    "createAddonAction",
  );
}

export async function updateAddonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded(
    formData,
    ADDON_FIELDS,
    async (userId, values) => {
      const parsed = updateAddonSchema.safeParse({
        id: text(formData, "id"),
        name: text(formData, "name"),
        price: text(formData, "price"),
      });
      if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors, values);

      const { id, ...fields } = parsed.data;
      if (!(await updateAddon(userId, id, fields))) return notFound(values);

      revalidatePath("/dashboard/paket", "layout");
      return {
        ok: true,
        data: undefined,
        values: { name: fields.name, price: String(fields.price) },
      };
    },
    "updateAddonAction",
  );
}

export async function deleteAddonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded(
    formData,
    [],
    async (userId, values) => {
      const parsed = idOnlySchema.safeParse({ id: text(formData, "id") });
      if (!parsed.success) return notFound(values);
      if (!(await deleteAddon(userId, parsed.data.id))) return notFound(values);

      revalidatePath("/dashboard/paket", "layout");
      return { ok: true, data: undefined };
    },
    "deleteAddonAction",
  );
}

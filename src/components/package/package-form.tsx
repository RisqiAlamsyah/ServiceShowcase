"use client";

import { useActionState, useRef } from "react";
import { createPackageAction, updatePackageAction } from "@/actions/package";
import { TextAreaField } from "@/components/ui/text-area-field";
import { TextField } from "@/components/ui/text-field";
import { useFocusFirstError } from "@/components/ui/use-focus-first-error";

export type PackageValues = { title: string; description: string; basePrice: string };

type Props = { mode: "create" } | { mode: "edit"; packageId: string; initial: PackageValues };

export function PackageForm(props: Props) {
  const isEdit = props.mode === "edit";
  const [state, formAction, pending] = useActionState(
    isEdit ? updatePackageAction : createPackageAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failed = Boolean(state && !state.ok);
  useFocusFirstError(failed, state, formRef);

  // Gagal: tampilkan isian yang dikirim (React me-reset form). Sukses edit: nilai tersimpan.
  // Sukses tambah: kosong (form siap dipakai lagi).
  const values: PackageValues | undefined =
    (state?.values as PackageValues | undefined) ?? (isEdit ? props.initial : undefined);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);
  const idPrefix = isEdit ? `package-${props.packageId}` : "package-new";

  return (
    <form
      key={state ? `${state.ok ? "ok" : "err"}:${JSON.stringify(state.values ?? null)}` : "init"}
      ref={formRef}
      action={formAction}
      className="space-y-5"
      noValidate
    >
      {isEdit ? <input type="hidden" name="id" value={props.packageId} /> : null}
      <TextField
        id={`${idPrefix}-title`}
        name="title"
        label="Nama paket"
        autoComplete="off"
        defaultValue={values?.title}
        errors={fieldErrors?.title}
        maxLength={100}
      />
      <TextField
        id={`${idPrefix}-price`}
        name="basePrice"
        label="Harga dasar (Rp)"
        inputMode="text"
        autoComplete="off"
        defaultValue={values?.basePrice}
        errors={fieldErrors?.basePrice}
        hint="Contoh: 2500000 atau 2.500.000"
        maxLength={30}
      />
      <TextAreaField
        id={`${idPrefix}-description`}
        name="description"
        label="Deskripsi (opsional)"
        defaultValue={values?.description}
        errors={fieldErrors?.description}
        hint="Maksimal 500 karakter."
        maxLength={500}
        rows={3}
      />

      <div aria-live="polite">
        {state && !state.ok && !hasFieldErrors ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="rounded-md border border-line bg-surface p-3 text-sm">
            {isEdit ? "Paket disimpan." : "Paket ditambahkan."}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : isEdit ? "Simpan paket" : "Tambah paket"}
      </button>
    </form>
  );
}

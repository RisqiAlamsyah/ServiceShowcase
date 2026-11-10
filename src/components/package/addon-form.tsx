"use client";

import { useActionState, useRef } from "react";
import { createAddonAction, updateAddonAction } from "@/actions/package";
import { TextField } from "@/components/ui/text-field";
import { useFocusFirstError } from "@/components/ui/use-focus-first-error";

export type AddonValues = { name: string; price: string };

type Props =
  { mode: "create"; packageId: string } | { mode: "edit"; addonId: string; initial: AddonValues };

export function AddonForm(props: Props) {
  const isEdit = props.mode === "edit";
  const [state, formAction, pending] = useActionState(
    isEdit ? updateAddonAction : createAddonAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failed = Boolean(state && !state.ok);
  useFocusFirstError(failed, state, formRef);

  const values: AddonValues | undefined =
    (state?.values as AddonValues | undefined) ?? (isEdit ? props.initial : undefined);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);
  const idPrefix = isEdit ? `addon-${props.addonId}` : "addon-new";

  return (
    <form
      key={state ? `${state.ok ? "ok" : "err"}:${JSON.stringify(state.values ?? null)}` : "init"}
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
    >
      {isEdit ? (
        <input type="hidden" name="id" value={props.addonId} />
      ) : (
        <input type="hidden" name="packageId" value={props.packageId} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-name`}
          name="name"
          label="Nama add-on"
          autoComplete="off"
          defaultValue={values?.name}
          errors={fieldErrors?.name}
          maxLength={100}
        />
        <TextField
          id={`${idPrefix}-price`}
          name="price"
          label="Harga (Rp)"
          autoComplete="off"
          defaultValue={values?.price}
          errors={fieldErrors?.price}
          hint="Contoh: 150000 atau 150.000"
          maxLength={30}
        />
      </div>

      <div aria-live="polite">
        {state && !state.ok && !hasFieldErrors ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm">
            {isEdit ? "Add-on disimpan." : "Add-on ditambahkan."}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-ink px-5 py-2 font-semibold text-canvas hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : isEdit ? "Simpan add-on" : "Tambah add-on"}
      </button>
    </form>
  );
}

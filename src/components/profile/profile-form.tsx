"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfileAction } from "@/actions/profile";
import { TextAreaField } from "@/components/ui/text-area-field";
import { TextField } from "@/components/ui/text-field";
import { SLUG_MAX, SLUG_MIN } from "@/lib/validation/profile";

export type ProfileValues = {
  businessName: string;
  whatsapp: string;
  bio: string;
  slug: string;
};

const EMPTY: ProfileValues = { businessName: "", whatsapp: "", bio: "", slug: "" };

export function ProfileForm({
  initial,
  siteHost,
}: {
  initial: ProfileValues | null;
  siteHost: string;
}) {
  const [state, formAction, pending] = useActionState(saveProfileAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Nilai tersimpan terakhir: dari hasil sukses, atau dari data awal di server.
  const savedSlug = state?.ok ? (state.values?.slug ?? "") : (initial?.slug ?? "");
  // Isian yang ditampilkan: dikembalikan dari action agar tidak hilang saat React me-reset form.
  const values = (state?.values as ProfileValues | undefined) ?? initial ?? EMPTY;
  const [slugDraft, setSlugDraft] = useState(values.slug);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);
  const slugChanging = savedSlug !== "" && slugDraft.trim().toLowerCase() !== savedSlug;

  // Fokus pindah ke kolom bermasalah pertama setelah submit gagal.
  useEffect(() => {
    if (!state || state.ok) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form
      key={state ? `${state.ok ? "ok" : "err"}:${JSON.stringify(state.values)}` : "init"}
      ref={formRef}
      action={formAction}
      className="space-y-5"
      noValidate
    >
      <TextField
        id="profile-business-name"
        name="businessName"
        label="Nama bisnis"
        autoComplete="organization"
        defaultValue={values.businessName}
        errors={fieldErrors?.businessName}
        maxLength={100}
      />
      <TextField
        id="profile-whatsapp"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        label="Nomor WhatsApp"
        autoComplete="tel"
        defaultValue={values.whatsapp}
        errors={fieldErrors?.whatsapp}
        hint="Contoh: 08123456789 atau +62 812-3456-7890. Dipakai calon klien untuk memesan."
        maxLength={30}
      />
      <TextField
        id="profile-slug"
        name="slug"
        label="Alamat halaman (slug)"
        autoComplete="off"
        prefix={`${siteHost}/`}
        defaultValue={values.slug}
        onValueChange={setSlugDraft}
        errors={fieldErrors?.slug}
        hint={`Huruf kecil, angka, dan tanda hubung, ${SLUG_MIN}–${SLUG_MAX} karakter.`}
        maxLength={SLUG_MAX}
      />

      {slugChanging ? (
        <div className="rounded-md border border-line bg-surface p-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="confirmSlugChange"
              aria-invalid={Boolean(fieldErrors?.confirmSlugChange)}
              aria-describedby="profile-slug-warning"
              className="mt-1 size-5 shrink-0"
            />
            <span id="profile-slug-warning">
              Saya mengerti: link lama{" "}
              <strong>
                {siteHost}/{savedSlug}
              </strong>{" "}
              akan berhenti berfungsi dan alamat itu dapat dipakai orang lain. Slug hanya bisa
              diganti 3 kali per hari.
            </span>
          </label>
          {fieldErrors?.confirmSlugChange ? (
            <p className="mt-2 text-sm text-danger">{fieldErrors.confirmSlugChange[0]}</p>
          ) : null}
        </div>
      ) : null}

      <TextAreaField
        id="profile-bio"
        name="bio"
        label="Bio singkat (opsional)"
        defaultValue={values.bio}
        errors={fieldErrors?.bio}
        hint="Maksimal 500 karakter."
        maxLength={500}
      />

      <div aria-live="polite">
        {state && !state.ok && !hasFieldErrors ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="rounded-md border border-line bg-surface p-3 text-sm">
            Profil disimpan. Alamat halaman Anda:{" "}
            <strong>
              {siteHost}/{state.data.slug}
            </strong>{" "}
            (halaman publik segera hadir).
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan profil"}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { calculateEstimate } from "@/lib/booking/calculator";
import type { PublicPackageOffer } from "@/lib/booking/types";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/booking/whatsapp";
import { formatRupiah } from "@/lib/money";
import { cx } from "@/lib/utils";
import { createBookingInputSchema } from "@/lib/validation/booking";

type FieldKey = "clientName" | "eventDate" | "packageId" | "addonIds";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_KEYS: readonly FieldKey[] = ["clientName", "eventDate", "packageId", "addonIds"];

function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && (FIELD_KEYS as readonly string[]).includes(value);
}

export type PriceCalculatorProps = {
  vendorPhone: string;
  packages: PublicPackageOffer[];
  /** false pada tier Free: add-on terkunci (SRS 7.1). */
  allowAddons: boolean;
  /** Tanggal hari ini (WIB) dari server, agar server dan klien memakai patokan yang sama. */
  todayIso: string;
};

// Mode demo: hanya menampilkan pratinjau pesan, tidak membuka WhatsApp.
export function PriceCalculator({
  vendorPhone,
  packages,
  allowAddons,
  todayIso,
}: Readonly<PriceCalculatorProps>) {
  const uid = useId();
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [clientName, setClientName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);

  const schema = useMemo(() => createBookingInputSchema(todayIso), [todayIso]);
  const selectedPackage = packages.find((p) => p.id === packageId);

  const estimate = useMemo(
    () =>
      selectedPackage
        ? calculateEstimate({
            pkg: selectedPackage,
            addons: selectedPackage.addons,
            selectedAddonIds: addonIds,
            allowAddons,
          })
        : null,
    [selectedPackage, addonIds, allowAddons],
  );

  useEffect(() => {
    if (preview !== null) previewRef.current?.focus();
  }, [preview]);

  function resetResult() {
    setPreview(null);
    setFormError(null);
  }

  function choosePackage(id: string) {
    setPackageId(id);
    setAddonIds([]); // add-on milik paket, jadi dikosongkan saat paket berganti
    setErrors((prev) => ({ ...prev, packageId: undefined, addonIds: undefined }));
    resetResult();
  }

  function toggleAddon(id: string) {
    if (!allowAddons) return;
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    resetResult();
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse({ clientName, eventDate, packageId, addonIds });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (isFieldKey(key) && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setPreview(null);
      if (next.clientName) nameRef.current?.focus();
      else if (next.eventDate) dateRef.current?.focus();
      return;
    }
    setErrors({});

    if (!selectedPackage || !estimate?.ok) {
      setFormError("Estimasi belum bisa dihitung. Periksa pilihan paket dan add-on.");
      setPreview(null);
      return;
    }

    const input = {
      clientName: parsed.data.clientName,
      eventDate: parsed.data.eventDate,
      estimate: estimate.data,
    };
    // Memastikan seluruh rantai (nomor vendor, panjang pesan) valid walau URL tidak dibuka pada mode demo.
    const url = buildWhatsAppUrl({ ...input, vendorPhone });
    if (!url.ok) {
      setFormError(url.message);
      setPreview(null);
      return;
    }
    setPreview(buildWhatsAppMessage(input));
  }

  const inputClass =
    "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted";

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="rounded-lg border border-line bg-surface p-5 sm:p-8"
    >
      <h2 id={`${uid}-title`} className="font-heading text-2xl font-semibold">
        Hitung estimasi biaya
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-8">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
            1. Pilih paket
          </legend>
          <div className="space-y-3">
            {packages.map((pkg) => {
              const checked = pkg.id === packageId;
              return (
                <label
                  key={pkg.id}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-4",
                    checked ? "border-accent bg-canvas" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-package`}
                    value={pkg.id}
                    checked={checked}
                    onChange={() => choosePackage(pkg.id)}
                    className="mt-1 size-5 shrink-0 accent-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">{pkg.title}</span>
                      <span className="font-semibold whitespace-nowrap">
                        {formatRupiah(pkg.basePrice)}
                      </span>
                    </span>
                    <span className="block text-sm text-muted">{pkg.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errors.packageId ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errors.packageId}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
            2. Tambahan (add-on)
          </legend>
          {!allowAddons ? (
            <p className="mb-3 rounded-md border border-line bg-canvas p-3 text-sm text-muted">
              Add-on tersedia di paket Pro. Pada paket Free, estimasi hanya menghitung harga paket.
            </p>
          ) : null}
          {selectedPackage && selectedPackage.addons.length > 0 ? (
            <div className="space-y-3">
              {selectedPackage.addons.map((addon) => {
                const checked = addonIds.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={cx(
                      "flex min-h-11 items-center gap-3 rounded-md border p-4",
                      allowAddons ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                      checked ? "border-accent bg-canvas" : "border-line",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!allowAddons}
                      onChange={() => toggleAddon(addon.id)}
                      className="size-5 shrink-0 accent-ink"
                    />
                    <span className="min-w-0 flex-1 font-medium">{addon.name}</span>
                    <span className="shrink-0 font-semibold">+ {formatRupiah(addon.price)}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">Paket ini tidak memiliki add-on.</p>
          )}
        </fieldset>

        <div className="rounded-md bg-ink px-5 py-4 text-canvas">
          <p className="text-sm text-canvas/80">Total estimasi</p>
          <p
            aria-live="polite"
            aria-atomic="true"
            data-testid="total-amount"
            className="font-heading text-3xl font-semibold"
          >
            {estimate?.ok ? formatRupiah(estimate.data.total) : "-"}
          </p>
        </div>

        <fieldset className="space-y-5">
          <legend className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">
            3. Data pemesanan
          </legend>
          <div>
            <label htmlFor={`${uid}-name`} className="font-medium">
              Nama Anda
            </label>
            <input
              id={`${uid}-name`}
              ref={nameRef}
              type="text"
              autoComplete="name"
              maxLength={60}
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                resetResult();
              }}
              aria-invalid={errors.clientName ? true : undefined}
              aria-describedby={errors.clientName ? `${uid}-name-error` : undefined}
              className={inputClass}
            />
            {errors.clientName ? (
              <p id={`${uid}-name-error`} className="mt-1 text-sm text-danger">
                {errors.clientName}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${uid}-date`} className="font-medium">
              Tanggal acara
            </label>
            <input
              id={`${uid}-date`}
              ref={dateRef}
              type="date"
              min={todayIso}
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value);
                resetResult();
              }}
              aria-invalid={errors.eventDate ? true : undefined}
              aria-describedby={errors.eventDate ? `${uid}-date-error` : undefined}
              className={inputClass}
            />
            {errors.eventDate ? (
              <p id={`${uid}-date-error`} className="mt-1 text-sm text-danger">
                {errors.eventDate}
              </p>
            ) : null}
          </div>
        </fieldset>

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-ink px-5 py-3 font-semibold text-canvas hover:bg-ink/90"
        >
          Buat pratinjau pesan
        </button>
      </form>

      {preview !== null ? (
        <div
          data-testid="wa-preview"
          className="mt-8 rounded-md border border-accent bg-canvas p-5"
        >
          <h3 ref={previewRef} tabIndex={-1} className="font-heading text-xl font-semibold">
            Pratinjau pesan WhatsApp
          </h3>
          <pre className="mt-3 font-body text-sm break-words whitespace-pre-wrap">{preview}</pre>
          <p className="mt-3 text-sm text-muted">
            Mode demo: tidak ada pesan yang dikirim. Pada halaman vendor sungguhan, tombol akan
            membuka WhatsApp dengan pesan ini.
          </p>
        </div>
      ) : null}
    </section>
  );
}

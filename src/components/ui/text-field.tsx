import { cx } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  inputMode?: "text" | "tel" | "email";
  autoComplete: string;
  errors?: string[] | undefined;
  hint?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  // Nilai kolom dilaporkan ke induk (mis. untuk menampilkan konfirmasi saat nilai berubah).
  onValueChange?: (value: string) => void;
  // Teks tetap di depan kolom (mis. alamat situs sebelum slug). Dibacakan lewat aria-describedby.
  prefix?: string;
};

const inputClass = "block min-h-11 w-full bg-surface px-3 py-2 text-base text-ink";

// Label terhubung ke input; galat dan petunjuk dibacakan lewat aria-describedby.
export function TextField({
  id,
  name,
  label,
  type = "text",
  inputMode,
  autoComplete,
  errors,
  hint,
  required = true,
  minLength,
  maxLength,
  defaultValue,
  placeholder,
  onValueChange,
  prefix,
}: Props) {
  const hasError = Boolean(errors?.length);
  const describedBy = [
    prefix ? `${id}-prefix` : null,
    hint ? `${id}-hint` : null,
    hasError ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const input = (
    <input
      id={id}
      name={name}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
      aria-invalid={hasError}
      aria-describedby={describedBy || undefined}
      className={cx(
        prefix ? `${inputClass} rounded-r-md` : `${inputClass} rounded-md border`,
        !prefix && (hasError ? "border-danger" : "border-line"),
      )}
    />
  );

  return (
    <div>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="mt-1">
        {prefix ? (
          <div
            className={cx(
              "flex items-stretch overflow-hidden rounded-md border",
              hasError ? "border-danger" : "border-line",
            )}
          >
            <span
              id={`${id}-prefix`}
              className="flex items-center bg-canvas px-3 text-sm break-all text-muted"
            >
              {prefix}
            </span>
            {input}
          </div>
        ) : (
          input
        )}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}

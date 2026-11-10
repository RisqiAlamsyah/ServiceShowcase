import { cx } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  errors?: string[] | undefined;
  hint?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
};

// Label terhubung ke input; galat dan petunjuk dibacakan lewat aria-describedby.
export function TextField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  errors,
  hint,
  required = true,
  minLength,
  maxLength,
  defaultValue,
}: Props) {
  const hasError = Boolean(errors?.length);
  const describedBy = [hint ? `${id}-hint` : null, hasError ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        className={cx(
          "mt-1 block min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-base text-ink",
          hasError ? "border-danger" : "border-line",
        )}
      />
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

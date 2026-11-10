import { cx } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  label: string;
  errors?: string[] | undefined;
  hint?: string;
  maxLength?: number;
  rows?: number;
  defaultValue?: string;
};

export function TextAreaField({
  id,
  name,
  label,
  errors,
  hint,
  maxLength,
  rows = 4,
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
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        className={cx(
          "mt-1 block w-full rounded-md border bg-surface px-3 py-2 text-base text-ink",
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

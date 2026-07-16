import type { SelectHTMLAttributes } from "react";
import { FieldError } from "./field-error";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { label: string; value: string }[];
}

export function SelectField({ label, error, hint, options, id, ...selectProps }: SelectFieldProps) {
  const fieldId = id ?? selectProps.name;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        {...selectProps}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

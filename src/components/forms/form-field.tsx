import type { InputHTMLAttributes } from "react";
import { FieldError } from "./field-error";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({ label, error, hint, id, className, ...inputProps }: FormFieldProps) {
  const fieldId = id ?? inputProps.name;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

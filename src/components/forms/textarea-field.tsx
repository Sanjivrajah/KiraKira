import type { TextareaHTMLAttributes } from "react";
import { FieldError } from "./field-error";

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextareaField({ label, error, hint, id, className, ...textareaProps }: TextareaFieldProps) {
  const fieldId = id ?? textareaProps.name;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className={`form-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        {...textareaProps}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

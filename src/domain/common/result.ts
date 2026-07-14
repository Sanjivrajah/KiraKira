export type Result<Value, ErrorValue> =
  | { ok: true; value: Value }
  | { ok: false; error: ErrorValue };

export function success<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function failure<ErrorValue>(error: ErrorValue): Result<never, ErrorValue> {
  return { ok: false, error };
}

import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Canonical JSON cannot contain a non-finite number.");
  }
  return value;
}

export function canonicalSerializeMyInvoisPayload(payload: unknown): string {
  const serialized = JSON.stringify(canonicalize(payload));
  if (serialized === undefined) throw new TypeError("MyInvois payload must be JSON serializable.");
  return serialized;
}

export function hashMyInvoisPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalSerializeMyInvoisPayload(payload), "utf8").digest("hex");
}

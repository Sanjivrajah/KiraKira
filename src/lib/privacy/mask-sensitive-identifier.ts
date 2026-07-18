export function maskSensitiveIdentifier(value: string | undefined) {
  return value?.trim() ? "****" : "Not provided";
}

const APP_ORIGIN = "https://niaga.invalid";

/** Keeps post-authentication redirects inside this application. */
export function safeAppPath(value: string | null | undefined, fallback: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

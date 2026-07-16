export type AuthMode = "demo" | "supabase";

type BrowserEnvironment = {
  NEXT_PUBLIC_AUTH_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NODE_ENV?: string;
};

/**
 * Keep each public value as a direct reference. Next.js inlines only direct
 * `process.env.NEXT_PUBLIC_*` accesses into client bundles; passing the whole
 * `process.env` object makes the browser silently fall back to demo mode.
 */
export function getPublicBrowserEnvironment(): BrowserEnvironment {
  return {
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function trim(value?: string) {
  return value?.trim() || undefined;
}

export function resolveAuthMode(environment: BrowserEnvironment = getPublicBrowserEnvironment()): AuthMode {
  const configuredMode = trim(environment.NEXT_PUBLIC_AUTH_MODE)?.toLowerCase();
  if (configuredMode === "demo" || configuredMode === "supabase") return configuredMode;
  if (configuredMode) throw new Error("NEXT_PUBLIC_AUTH_MODE must be either 'demo' or 'supabase'.");

  // Existing local checkouts remain usable, but production never quietly becomes
  // a browser-local demo when its configuration was omitted.
  return environment.NODE_ENV === "production" ? "supabase" : "demo";
}

export function getBrowserSupabaseConfig(environment: BrowserEnvironment = getPublicBrowserEnvironment()) {
  const mode = resolveAuthMode(environment);
  const url = trim(environment.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = trim(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (mode === "supabase" && (!url || !publishableKey)) {
    return {
      mode,
      error: "Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      publishableKey,
      url,
    } as const;
  }

  return { mode, error: null, publishableKey, url } as const;
}

export function requireBrowserSupabaseConfig() {
  const configuration = getBrowserSupabaseConfig();
  if (configuration.mode !== "supabase" || configuration.error || !configuration.url || !configuration.publishableKey) {
    throw new Error(configuration.error ?? "Supabase client is unavailable while demo mode is active.");
  }
  return {
    mode: "supabase" as const,
    publishableKey: configuration.publishableKey,
    url: configuration.url,
  };
}

export function isLocalSupabaseUrl(url: string) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

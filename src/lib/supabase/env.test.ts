import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserSupabaseConfig, getPublicBrowserEnvironment, resolveAuthMode } from "./env";

describe("Supabase environment configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads public values through direct client-safe environment references", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    expect(getPublicBrowserEnvironment()).toMatchObject({
      NEXT_PUBLIC_AUTH_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    expect(getBrowserSupabaseConfig()).toMatchObject({ mode: "supabase", error: null });
  });

  it("defaults local development to Supabase when no mode is supplied", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" })).toBe("supabase");
  });

  it("never silently defaults production to demo mode", () => {
    expect(resolveAuthMode({ NODE_ENV: "production" })).toBe("supabase");
  });

  it("requires both browser-safe values in Supabase mode", () => {
    expect(getBrowserSupabaseConfig({ NEXT_PUBLIC_AUTH_MODE: "supabase" }).error)
      .toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("accepts a complete Supabase browser configuration", () => {
    expect(getBrowserSupabaseConfig({
      NEXT_PUBLIC_AUTH_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    })).toMatchObject({ mode: "supabase", error: null });
  });
});

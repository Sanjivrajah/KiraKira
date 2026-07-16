import { describe, expect, it } from "vitest";
import { getBrowserSupabaseConfig, resolveAuthMode } from "./env";

describe("Supabase environment configuration", () => {
  it("keeps local development in demo mode when no mode is supplied", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" })).toBe("demo");
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

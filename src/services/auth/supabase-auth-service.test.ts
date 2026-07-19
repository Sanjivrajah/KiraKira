import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AuthServiceError } from "./auth-service-error";
import { SupabaseAuthService } from "./supabase-auth-service";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 1_725_000_000,
    user: {
      id: "supabase-user",
      app_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
      email: "lina@example.com",
      user_metadata: { name: "Lina Hassan" },
    },
    ...overrides,
  } as Session;
}

function makeClient(auth: Partial<SupabaseClient["auth"]>) {
  return { auth } as unknown as SupabaseClient;
}

describe("SupabaseAuthService", () => {
  it("maps the active Supabase session to the app auth contract", async () => {
    const service = new SupabaseAuthService(() => makeClient({
      getSession: vi.fn().mockResolvedValue({ data: { session: makeSession() }, error: null }),
    }));

    await expect(service.getSession()).resolves.toEqual({
      user: { id: "supabase-user", email: "lina@example.com", name: "Lina Hassan" },
      expiresAt: "2024-08-30T06:40:00.000Z",
    });
  });

  it("signs in with normalized email and publishes the returned session", async () => {
    const listener = vi.fn();
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: makeSession() }, error: null });
    const service = new SupabaseAuthService(() => makeClient({
      signInWithPassword,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    }));

    const unsubscribe = service.subscribe(listener);
    await service.signIn({ email: " Lina@Example.com ", password: "secret123", captchaToken: "sign-in-captcha" });
    unsubscribe();

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "lina@example.com",
      password: "secret123",
      options: { captchaToken: "sign-in-captcha" },
    });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "supabase-user" }) }));
  });

  it("passes owner name metadata during sign-up", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: makeSession() }, error: null });
    const service = new SupabaseAuthService(() => makeClient({ signUp }));

    await service.signUp({ name: " Lina Hassan ", email: "Lina@Example.com", password: "secret123", captchaToken: "sign-up-captcha" });

    expect(signUp).toHaveBeenCalledWith({
      email: "lina@example.com",
      password: "secret123",
      options: {
        captchaToken: "sign-up-captcha",
        data: { name: "Lina Hassan", full_name: "Lina Hassan" },
      },
    });
  });

  it("starts Google OAuth with a PKCE callback and safe destination", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { provider: "google", url: "https://accounts.google.com" }, error: null });
    const service = new SupabaseAuthService(() => makeClient({ signInWithOAuth }));

    await service.signInWithGoogle({ authPage: "signup", next: "/transactions?filter=attention" });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback?next=%2Ftransactions%3Ffilter%3Dattention&authPage=signup",
      },
    });
  });

  it("does not pass an external post-authentication destination to Google OAuth", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { provider: "google", url: "https://accounts.google.com" }, error: null });
    const service = new SupabaseAuthService(() => makeClient({ signInWithOAuth }));

    await service.signInWithGoogle({ authPage: "login", next: "https://example.com" });

    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fdashboard&authPage=login" },
    }));
  });

  it("returns a safe error when Google OAuth cannot start", async () => {
    const service = new SupabaseAuthService(() => makeClient({
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: { message: "provider details" } }),
    }));

    await expect(service.signInWithGoogle({ authPage: "signup" })).rejects.toEqual(
      new AuthServiceError("Google sign-in is temporarily unavailable. Please try again."),
    );
  });

  it("returns safe auth errors from Supabase failures", async () => {
    const service = new SupabaseAuthService(() => makeClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "Invalid login credentials" } }),
    }));

    await expect(service.signIn({ email: "lina@example.com", password: "wrongpass1" })).rejects.toEqual(
      new AuthServiceError("Invalid login credentials"),
    );
  });
});

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { safeAppPath } from "@/lib/auth/safe-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { AuthService, AuthSession, GoogleSignInInput, SignInInput, SignUpInput } from "@/types";
import { AuthServiceError } from "./auth-service-error";

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const metadataName = session.user.user_metadata.name ?? session.user.user_metadata.full_name;
  const name = typeof metadataName === "string" ? metadataName : null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name,
    },
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

function toAuthError(message?: string) {
  return new AuthServiceError(message || "Authentication failed. Check the details and try again.");
}

export class SupabaseAuthService implements AuthService {
  private readonly listeners = new Set<(session: AuthSession | null) => void>();

  constructor(private readonly getClient: () => SupabaseClient = getSupabaseBrowserClient) {}

  async getSession() {
    const { data, error } = await this.getClient().auth.getSession();
    if (error) throw toAuthError(error.message);
    return toAuthSession(data.session);
  }

  async signIn(input: SignInInput) {
    const { data, error } = await this.getClient().auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { captchaToken: input.captchaToken },
    });
    if (error) throw toAuthError(error.message);
    const session = toAuthSession(data.session);
    if (!session) throw toAuthError("Sign in succeeded, but no session was returned.");
    this.emit(session);
    return session;
  }

  async signUp(input: SignUpInput) {
    const name = input.name.trim();
    const { data, error } = await this.getClient().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        captchaToken: input.captchaToken,
        data: { name, full_name: name },
      },
    });
    if (error) throw toAuthError(error.message);
    const session = toAuthSession(data.session);
    if (!session) throw toAuthError("Account created. Check your email to confirm it before signing in.");
    this.emit(session);
    return session;
  }

  async signInWithGoogle(input: GoogleSignInInput) {
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", safeAppPath(input.next, "/dashboard"));
    callbackUrl.searchParams.set("authPage", input.authPage);

    const { error } = await this.getClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) throw new AuthServiceError("Google sign-in is temporarily unavailable. Please try again.");
  }

  async signOut() {
    const { error } = await this.getClient().auth.signOut();
    if (error) throw toAuthError(error.message);
    this.emit(null);
  }

  subscribe(listener: (session: AuthSession | null) => void) {
    this.listeners.add(listener);
    const { data } = this.getClient().auth.onAuthStateChange((_event, session) => {
      this.emit(toAuthSession(session));
    });
    return () => {
      this.listeners.delete(listener);
      data.subscription.unsubscribe();
    };
  }

  private emit(session: AuthSession | null) {
    for (const listener of this.listeners) listener(session);
  }
}

export const supabaseAuthService = new SupabaseAuthService();

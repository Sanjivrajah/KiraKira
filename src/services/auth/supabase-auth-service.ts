import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { AuthService, AuthSession, SignInInput, SignUpInput } from "@/types";
import { AuthServiceError } from "./auth-service-error";

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const name = typeof session.user.user_metadata.name === "string" ? session.user.user_metadata.name : null;
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
      options: { data: { name, full_name: name } },
    });
    if (error) throw toAuthError(error.message);
    const session = toAuthSession(data.session);
    if (!session) throw toAuthError("Account created. Check your email to confirm it before signing in.");
    this.emit(session);
    return session;
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

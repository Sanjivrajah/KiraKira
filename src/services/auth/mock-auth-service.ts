import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import { DEMO_AUTH_ERROR_EMAIL, DEMO_USER } from "@/data/demo";
import type { AuthService, AuthSession, AuthUser, SignInInput, SignUpInput } from "@/types";

export { DEMO_AUTH_ERROR_EMAIL } from "@/data/demo";
export const DEMO_USER_EMAIL = DEMO_USER.email;

export class MockAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockAuthError";
  }
}

export function makeLocalUserId(email: string) {
  let hash = 0;
  for (const character of email.toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return email.toLowerCase() === DEMO_USER_EMAIL ? "demo-lina" : `local-${hash.toString(36)}`;
}

function displayNameFromEmail(email: string) {
  return (email.split("@")[0] || "Demo user").split(/[._-]/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export class MockAuthService implements AuthService {
  private readonly listeners = new Set<(session: AuthSession | null) => void>();

  constructor(private readonly storage: KeyValueStorage = browserStorage) {}

  async getSession() {
    return this.storage.get<AuthSession | null>(STORAGE_KEYS.authSession, null);
  }

  async signIn(input: SignInInput) {
    const email = input.email.trim().toLowerCase();
    if (email === DEMO_AUTH_ERROR_EMAIL) throw new MockAuthError("This demo account is set to fail. Try another email address.");
    const users = this.storage.get<AuthUser[]>(STORAGE_KEYS.authUsers, []);
    const existing = users.find((user) => user.email === email);
    const user = existing ?? (email === DEMO_USER.email ? DEMO_USER : { id: makeLocalUserId(email), email, name: displayNameFromEmail(email) });
    if (!existing) this.storage.set(STORAGE_KEYS.authUsers, [user, ...users]);
    return this.persistSession({ user, expiresAt: null });
  }

  async signUp(input: SignUpInput) {
    const email = input.email.trim().toLowerCase();
    const user = { id: makeLocalUserId(email), email, name: input.name.trim() };
    const users = this.storage.get<AuthUser[]>(STORAGE_KEYS.authUsers, []).filter((item) => item.email !== email);
    this.storage.set(STORAGE_KEYS.authUsers, [user, ...users]);
    return this.persistSession({ user, expiresAt: null });
  }

  async signOut() {
    this.storage.remove(STORAGE_KEYS.authSession);
    this.emit(null);
  }

  async reset() {
    this.storage.remove(STORAGE_KEYS.authSession);
    this.storage.remove(STORAGE_KEYS.authUsers);
    this.storage.remove(STORAGE_KEYS.legacySession);
    this.emit(null);
  }

  subscribe(listener: (session: AuthSession | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persistSession(session: AuthSession) {
    this.storage.set(STORAGE_KEYS.authSession, session);
    this.emit(session);
    return session;
  }

  private emit(session: AuthSession | null) {
    for (const listener of this.listeners) listener(session);
  }
}

export const mockAuthService = new MockAuthService();

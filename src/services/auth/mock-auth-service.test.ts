import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import { DEMO_AUTH_ERROR_EMAIL, MockAuthError, MockAuthService } from "./mock-auth-service";

describe("MockAuthService", () => {
  const service = new MockAuthService(new BrowserStorage());

  beforeEach(() => localStorage.clear());

  it("starts without a session and signs in deterministically", async () => {
    expect(await service.getSession()).toBeNull();
    const first = await service.signIn({ email: "Lina@NiagaAI.demo", password: "demo1234" });
    await service.signOut();
    const second = await service.signIn({ email: "lina@niagaai.demo", password: "different-value" });
    expect(first.user).toEqual(second.user);
    expect(second.user.id).toBe("demo-lina");
  });

  it("returns the deterministic mock failure", async () => {
    await expect(service.signIn({ email: DEMO_AUTH_ERROR_EMAIL, password: "demo1234" })).rejects.toBeInstanceOf(MockAuthError);
    expect(await service.getSession()).toBeNull();
  });

  it("signs up, publishes session changes, and signs out", async () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    const session = await service.signUp({ name: "Aisyah", email: "aisyah@example.com", password: "secret123" });
    expect(session.user).toMatchObject({ name: "Aisyah", email: "aisyah@example.com" });
    await service.signOut();
    expect(listener).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });

  it("never persists passwords and reset removes the local demo user", async () => {
    await service.signUp({ name: "Aisyah", email: "aisyah@example.com", password: "never-store-this" });
    expect(JSON.stringify(localStorage)).not.toContain("never-store-this");
    await service.reset();
    expect(localStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.authUsers)).toBeNull();
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { services } from "@/services";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { AuthService, AuthSession, SignInInput, SignUpInput } from "@/types";
import { AuthGate } from "./auth-gate";
import { AuthProvider, useAuth } from "./auth-provider";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

class TestAuthService implements AuthService {
  listeners = new Set<(session: AuthSession | null) => void>();
  constructor(public session: AuthSession | null, private readonly pending?: Promise<AuthSession | null>) {}
  getSession() { return this.pending ?? Promise.resolve(this.session); }
  async signIn(input: SignInInput) { return this.publish({ user: { id: "test-user", email: input.email, name: "Test User" } }); }
  async signUp(input: SignUpInput) { return this.publish({ user: { id: "test-user", email: input.email, name: input.name } }); }
  async signOut() { this.publish(null); }
  async reset() { this.publish(null); }
  subscribe(listener: (session: AuthSession | null) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private publish(session: AuthSession | null) { this.session = session; for (const listener of this.listeners) listener(session); return session as AuthSession; }
}

function Status() {
  const { status, signOut, resetDemo } = useAuth();
  return <><span>{status}</span><button onClick={() => signOut()}>Sign out now</button><button onClick={() => resetDemo()}>Reset now</button></>;
}

function renderWithAuth(service: TestAuthService, child: React.ReactNode, client = createQueryClient()) {
  return { client, ...render(<QueryClientProvider client={client}><AuthProvider service={service}>{child}</AuthProvider></QueryClientProvider>) };
}

describe("authentication boundaries", () => {
  const session = { user: { id: "test-user", email: "test@example.com", name: "Test User" } };

  beforeEach(() => {
    localStorage.clear();
    navigation.replace.mockReset();
    useNiagaStore.getState().resetTemporaryUi();
  });

  it("reports loading until the initial session resolves", async () => {
    let resolve!: (value: AuthSession | null) => void;
    const pending = new Promise<AuthSession | null>((done) => { resolve = done; });
    renderWithAuth(new TestAuthService(null, pending), <Status />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    resolve(null);
    await waitFor(() => expect(screen.getByText("unauthenticated")).toBeInTheDocument());
  });

  it("redirects an unauthenticated protected route and preserves its destination", async () => {
    renderWithAuth(new TestAuthService(null), <AuthGate gate="dashboard"><p>Private dashboard</p></AuthGate>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Fdashboard"));
    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
  });

  it("redirects an authenticated user without a business to onboarding", async () => {
    renderWithAuth(new TestAuthService(session), <AuthGate gate="dashboard"><p>Private dashboard</p></AuthGate>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("allows dashboard access when membership and business data exist", async () => {
    await services.businesses.saveForUser("test-user", { name: "Test Shop", type: "retail", registrationNumber: "", tin: "", currency: "MYR", preferredLanguage: "en" });
    renderWithAuth(new TestAuthService(session), <AuthGate gate="dashboard"><p>Private dashboard</p></AuthGate>);
    expect(await screen.findByText("Private dashboard")).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("clears query and temporary UI state on sign-out", async () => {
    const client = createQueryClient();
    client.setQueryData(["private"], { secret: true });
    useNiagaStore.getState().setOnboardingStep(3);
    renderWithAuth(new TestAuthService(session), <Status />, client);
    await screen.findByText("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Sign out now" }));
    await waitFor(() => expect(screen.getByText("unauthenticated")).toBeInTheDocument());
    expect(client.getQueryData(["private"])).toBeUndefined();
    expect(useNiagaStore.getState().onboardingStep).toBe(1);
  });

  it("full reset clears domain data and the active session", async () => {
    await services.businesses.saveForUser("test-user", { name: "Test Shop", type: "retail", registrationNumber: "", tin: "", currency: "MYR", preferredLanguage: "en" });
    renderWithAuth(new TestAuthService(session), <Status />);
    await screen.findByText("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Reset now" }));
    await waitFor(() => expect(screen.getByText("unauthenticated")).toBeInTheDocument());
    expect(await services.businesses.getForUser("test-user")).toBeNull();
  });
});

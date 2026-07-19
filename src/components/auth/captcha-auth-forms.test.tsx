import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import type { AuthService, AuthSession, SignInInput, SignUpInput } from "@/types";
import { AuthProvider } from "./auth-provider";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

const captcha = vi.hoisted(() => ({ reset: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@hcaptcha/react-hcaptcha", async () => {
  const React = await import("react");

  return {
    default: React.forwardRef(function MockHCaptcha(
      { onVerify, sitekey }: { onVerify?(token: string, ekey: string): void; sitekey: string },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({ resetCaptcha: captcha.reset }));
      return <button data-sitekey={sitekey} onClick={() => onVerify?.("captcha-token", "test-ekey")} type="button">Complete bot protection</button>;
    }),
  };
});

const session: AuthSession = {
  user: { id: "test-user", email: "owner@example.com", name: "Test Owner" },
};

class RecordingAuthService implements AuthService {
  signIn = vi.fn(async (input: SignInInput) => ({
    ...session,
    user: { ...session.user, email: input.email },
  }));
  signUp = vi.fn(async (input: SignUpInput) => ({
    ...session,
    user: { ...session.user, email: input.email, name: input.name },
  }));

  async getSession() { return null; }
  async signInWithGoogle() {}
  async signOut() {}
  subscribe() { return () => undefined; }
}

function renderWithSupabase(ui: ReactElement, service: RecordingAuthService) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider mode="supabase" service={service}>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
}

describe("hCaptcha authentication forms", () => {
  beforeEach(() => {
    captcha.reset.mockReset();
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "test-site-key");
  });

  it("requires and forwards a fresh token when signing in", async () => {
    const service = new RecordingAuthService();
    renderWithSupabase(<SignInForm />, service);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Complete the bot protection check before signing in.")).toBeInTheDocument();
    expect(service.signIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Complete bot protection" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(service.signIn).toHaveBeenCalledWith({
      captchaToken: "captcha-token",
      email: "owner@example.com",
      password: "secret123",
    }));
    expect(captcha.reset).toHaveBeenCalledOnce();
  });

  it("forwards the token when creating an account", async () => {
    const service = new RecordingAuthService();
    renderWithSupabase(<SignUpForm />, service);

    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Test Owner" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password", { selector: "input" }), { target: { value: "secret123" } });
    fireEvent.click(screen.getByLabelText("I understand this account is for the NiagaAI prototype workspace."));
    fireEvent.click(screen.getByRole("button", { name: "Complete bot protection" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(service.signUp).toHaveBeenCalledWith({
      captchaToken: "captcha-token",
      email: "owner@example.com",
      name: "Test Owner",
      password: "secret123",
    }));
    expect(captcha.reset).toHaveBeenCalledOnce();
  });
});

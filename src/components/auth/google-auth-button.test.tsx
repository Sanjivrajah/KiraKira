import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthButton } from "./google-auth-button";

const auth = vi.hoisted(() => ({ mode: "supabase" as "supabase" | "demo", signInWithGoogle: vi.fn() }));
const navigation = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("./auth-provider", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.searchParams }));

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    auth.mode = "supabase";
    auth.signInWithGoogle.mockReset().mockResolvedValue(undefined);
    navigation.searchParams = new URLSearchParams();
  });

  it("starts Google sign-up and preserves the intended app destination", async () => {
    navigation.searchParams = new URLSearchParams("next=%2Ftransactions%3Ffilter%3Dattention");
    render(<GoogleAuthButton authPage="signup" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledWith({
      authPage: "signup",
      next: "/transactions?filter=attention",
    }));
    expect(screen.getByRole("button", { name: "Opening Google…" })).toBeDisabled();
  });

  it("shows a useful message after a failed callback", () => {
    navigation.searchParams = new URLSearchParams("authError=google_oauth");
    render(<GoogleAuthButton authPage="login" />);

    expect(screen.getByRole("alert")).toHaveTextContent("We could not complete Google sign-in. Please try again.");
  });

  it("does not offer Google auth in browser-local demo mode", () => {
    auth.mode = "demo";
    render(<GoogleAuthButton authPage="signup" />);

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });
});

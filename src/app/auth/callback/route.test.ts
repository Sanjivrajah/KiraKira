import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));

vi.mock("@/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({ auth }),
}));

describe("Google OAuth callback", () => {
  beforeEach(() => {
    auth.exchangeCodeForSession.mockReset();
  });

  it("exchanges the PKCE code and redirects to the requested app path", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const response = await GET(new Request("https://niaga.example/auth/callback?code=oauth-code&next=%2Ftransactions%3Ffilter%3Dattention"));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.headers.get("location")).toBe("https://niaga.example/transactions?filter=attention");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects external destinations after a successful exchange", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const response = await GET(new Request("https://niaga.example/auth/callback?code=oauth-code&next=https%3A%2F%2Fexample.com"));

    expect(response.headers.get("location")).toBe("https://niaga.example/dashboard");
  });

  it("returns signup users to a safe error message when exchange fails", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: "invalid code" } });

    const response = await GET(new Request("https://niaga.example/auth/callback?code=bad-code&authPage=signup"));

    expect(response.headers.get("location")).toBe("https://niaga.example/signup?authError=google_oauth");
  });
});

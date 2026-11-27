import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveAuthMode: vi.fn((): "supabase" | "demo" => "supabase"),
  createLiveVoiceSession: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ resolveAuthMode: mocks.resolveAuthMode }));
vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/openai/live-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openai/live-session")>("@/lib/openai/live-session");
  return { ...actual, createLiveVoiceSession: mocks.createLiveVoiceSession };
});

import { LiveSessionError } from "@/lib/openai/live-session";
import { POST } from "./route";

function supabaseClient(displayName: string | null, metadata: Record<string, unknown> = {}, signedIn = true) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: displayName }, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(signedIn
        ? { data: { user: { id: "user-1", user_metadata: metadata } }, error: null }
        : { data: { user: null }, error: new Error("no session") }),
    },
    from: vi.fn(() => ({ select })),
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/voice/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { sdp: "v=0 offer", businessName: "Kedai Ali" };

describe("POST /api/voice/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthMode.mockReturnValue("supabase");
    process.env.OPENAI_API_KEY = "test-key";
    mocks.createLiveVoiceSession.mockResolvedValue({ sessionId: "live_123", sdp: "answer" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseClient("Sanjivrajah", { name: "Official Sanjivrajah" }));
  });

  it("returns the SDP answer and passes business-aware instructions", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ sdp: "answer", sessionId: "live_123", ownerName: "Sanjivrajah" });
    const [input] = mocks.createLiveVoiceSession.mock.calls[0] as [{ sdp: string; instructions: string }];
    expect(input.sdp).toBe("v=0 offer");
    expect(input.instructions).toContain("Kedai Ali");
    expect(input.instructions).toContain("Sanjivrajah");
  });

  it("falls back to user-entered auth metadata when the profile name is missing", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseClient(null, { full_name: "Sanjivrajah" }));
    const response = await POST(request(validBody));
    await expect(response.json()).resolves.toMatchObject({ ownerName: "Sanjivrajah" });
  });

  it("uses the browser-supplied owner name in demo mode", async () => {
    mocks.resolveAuthMode.mockReturnValue("demo");
    const response = await POST(request({ ...validBody, ownerName: "Demo Owner" }));
    await expect(response.json()).resolves.toMatchObject({ ownerName: "Demo Owner" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns 503 when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(request(validBody));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The voice assistant is not configured." });
  });

  it("returns 401 without a signed-in user", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseClient(null, {}, false));
    const response = await POST(request(validBody));
    expect(response.status).toBe(401);
    expect(mocks.createLiveVoiceSession).not.toHaveBeenCalled();
  });

  it.each([
    ["missing sdp", { businessName: "Kedai Ali" }],
    ["empty business name", { sdp: "v=0", businessName: "   " }],
    ["oversized business name", { sdp: "v=0", businessName: "x".repeat(121) }],
  ])("returns 400 for %s", async (_label, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(mocks.createLiveVoiceSession).not.toHaveBeenCalled();
  });

  it("accepts a business name of exactly 120 characters", async () => {
    const response = await POST(request({ sdp: "v=0", businessName: "x".repeat(120) }));
    expect(response.status).toBe(200);
  });

  it("returns 400 for a non-JSON body", async () => {
    const response = await POST(new Request("http://localhost/api/voice/session", { method: "POST", body: "nope" }));
    expect(response.status).toBe(400);
  });

  it("hides provider failures behind a safe 502", async () => {
    mocks.createLiveVoiceSession.mockRejectedValue(new LiveSessionError(500, "secret provider detail"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret provider detail");
  });

  it("passes rate limiting through as 429", async () => {
    mocks.createLiveVoiceSession.mockRejectedValue(new LiveSessionError(429, "slow down"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(429);
  });
});

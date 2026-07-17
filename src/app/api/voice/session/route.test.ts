import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveAuthMode: vi.fn(() => "supabase" as const),
}));

vi.mock("@/lib/supabase/env", () => ({ resolveAuthMode: mocks.resolveAuthMode }));
vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { GET } from "./route";

function supabaseClient(displayName: string | null, metadata: Record<string, unknown> = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: displayName }, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", user_metadata: metadata } }, error: null }) },
    from: vi.fn(() => ({ select })),
  };
}

describe("GET /api/voice/session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_AGENT_ID = "test-agent";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ token: "voice-token" })));
  });

  it("returns the canonical profile display name with the voice token", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseClient("Sanjivrajah", { name: "Official Sanjivrajah" }));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: "voice-token", ownerName: "Sanjivrajah" });
  });

  it("falls back to user-entered auth metadata when the profile name is missing", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseClient(null, { full_name: "Sanjivrajah" }));

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({ ownerName: "Sanjivrajah" });
  });
});

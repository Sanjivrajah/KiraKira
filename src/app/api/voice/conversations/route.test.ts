import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveAuthMode: vi.fn<() => "demo" | "supabase">(() => "supabase"),
}));

vi.mock("@/lib/supabase/env", () => ({ resolveAuthMode: mocks.resolveAuthMode }));
vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { POST, PUT } from "./route";

const businessId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";

function request(method: string, body: object) {
  return new Request("http://localhost/api/voice/conversations", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authenticatedClient() {
  const membership = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { business_id: businessId }, error: null }),
  };
  const conversations = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: conversationId, retention_delete_after: "2026-10-15T00:00:00.000Z" },
      error: null,
    }),
  };
  const turns = { upsert: vi.fn().mockResolvedValue({ error: null }) };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "business_members") return membership;
      if (table === "voice_conversations") return conversations;
      return turns;
    }),
  };
  return { client, conversations, turns };
}

describe("/api/voice/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthMode.mockReturnValue("supabase");
  });

  it("keeps transcript persistence disabled in demo mode", async () => {
    mocks.resolveAuthMode.mockReturnValue("demo");

    const response = await POST(request("POST", { businessId, providerConversationId: "provider-1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false, conversationId: null });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("creates a business-scoped session using the authenticated user", async () => {
    const { client, conversations } = authenticatedClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);

    const response = await POST(request("POST", { businessId, providerConversationId: "provider-1" }));

    expect(response.status).toBe(201);
    expect(conversations.insert).toHaveBeenCalledWith({
      business_id: businessId,
      user_id: "user-1",
      provider_conversation_id: "provider-1",
    });
    await expect(response.json()).resolves.toMatchObject({ enabled: true, conversationId });
  });

  it("rejects unexpected raw-audio data at the transcript boundary", async () => {
    const response = await POST(request("POST", {
      businessId,
      providerConversationId: "provider-1",
      audio: "base64-data-must-not-be-stored",
    }));

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("upserts progressively fuller text under the same turn index", async () => {
    const { client, turns } = authenticatedClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);

    const response = await PUT(request("PUT", {
      conversationId,
      turnIndex: 1,
      role: "user",
      content: "I spent RM45 on petrol",
    }));

    expect(response.status).toBe(200);
    expect(turns.upsert).toHaveBeenCalledWith({
      conversation_id: conversationId,
      turn_index: 1,
      role: "user",
      content: "I spent RM45 on petrol",
    }, { onConflict: "conversation_id,turn_index" });
  });
});
